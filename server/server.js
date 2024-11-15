// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const firebase = require('firebase-admin');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// MongoDB connection string - replace with your MongoDB URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rescue-ranger';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Schemas
const readingSchema = new mongoose.Schema({
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    deviceId: {
        type: String,
        required: true
    },
    heartRate: {
        type: Number,
        required: true,
        min: 0,
        max: 250
    },
    spO2: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    location: {
        latitude: {
            type: Number,
            required: true
        },
        longitude: {
            type: Number,
            required: true
        }
    },
    batteryLevel: {
        type: Number,
        min: 0,
        max: 100
    },
    emergencyStatus: {
        type: Boolean,
        default: false
    }
});

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    emergencyContacts: [{
        name: String,
        phone: String,
        email: String,
        relationship: String
    }],
    medicalInfo: {
        bloodGroup: String,
        allergies: [String],
        medications: [String],
        conditions: [String]
    }
});

// Create models
const Reading = mongoose.model('Reading', readingSchema);
const User = mongoose.model('User', userSchema);

// Middleware for error handling
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Server error',
        message: err.message
    });
};

// Routes
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Get latest readings for a device
app.get('/api/readings/:deviceId/latest', async (req, res, next) => {
    try {
        const reading = await Reading.findOne({ deviceId: req.params.deviceId })
            .sort({ timestamp: -1 });
            
        if (!reading) {
            return res.status(404).json({
                success: false,
                message: 'No readings found for this device'
            });
        }
        
        res.json({
            success: true,
            data: reading
        });
    } catch (err) {
        next(err);
    }
});

// Get readings history for a device
app.get('/api/readings/:deviceId/history', async (req, res, next) => {
    try {
        const { hours = 24 } = req.query;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        const readings = await Reading.find({
            deviceId: req.params.deviceId,
            timestamp: { $gte: since }
        }).sort({ timestamp: -1 });
        
        res.json({
            success: true,
            data: readings
        });
    } catch (err) {
        next(err);
    }
});

// Post new reading from device
app.post('/api/readings', async (req, res, next) => {
    try {
        const reading = new Reading(req.body);
        
        // Check for emergency conditions
        const isEmergency = checkEmergencyConditions(req.body);
        reading.emergencyStatus = isEmergency;
        
        await reading.save();
        
        // If emergency is detected, trigger emergency protocol
        if (isEmergency) {
            await handleEmergency(reading);

            // Send emergency data to frontend
            res.status(200).json({
                success: true,
                data: {
                    userId: reading.userId,
                    deviceId: reading.deviceId,
                    heartRate: reading.heartRate,
                    spO2: reading.spO2,
                    location: reading.location
                }
            });
        } else {
            res.status(201).json({
                success: true,
                data: reading,
                emergency: isEmergency
            });
        }
    } catch (err) {
        next(err);
    }
});

// Register new user/device
app.post('/api/users', async (req, res, next) => {
    try {
        const user = new User(req.body);
        await user.save();
        
        res.status(201).json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
});

// Update user information
app.put('/api/users/:deviceId', async (req, res, next) => {
    try {
        const user = await User.findOneAndUpdate(
            { deviceId: req.params.deviceId },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        res.json({
            success: true,
            data: user
        });
    } catch (err) {
        next(err);
    }
});

// Helper functions
function checkEmergencyConditions(reading) {
    const { heartRate, spO2 } = reading;
    return (
        heartRate < 60 || 
        heartRate > 100 || 
        spO2 < 95
    );
}

async function handleEmergency(reading) {
    try {
        // Get user information
        const user = await User.findOne({ deviceId: reading.deviceId });

        if (!user) {
            console.error('User not found for emergency handling');
            return;
        }

        // Log emergency
        console.log(`Emergency detected for user ${user.name} (Device: ${reading.deviceId})`);
        console.log(`Heart Rate: ${reading.heartRate}, SpO2: ${reading.spO2}`);
        console.log(`Location: ${reading.location.latitude}, ${reading.location.longitude}`);

        // Notify emergency contacts
        await notifyEmergencyContacts(user, reading);

        // Call emergency services
        await callEmergencyServices(reading.location, `Emergency for user ${user.name}`);

        // Send push notifications
        await sendPushNotifications(user.deviceId, 'Emergency Alert', `Emergency for user ${user.name}`);

        // Send SMS alerts
        await sendSMSAlerts(user.emergencyContacts.map(contact => contact.phone), `Emergency for user ${user.name}`);
    } catch (err) {
        console.error('Error handling emergency:', err);
    }
}

// Emergency contact notification
async function notifyEmergencyContacts(user, reading) {
    // Initialize Nodemailer transporter
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    for (const contact of user.emergencyContacts) {
        // Send email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: contact.email,
            subject: 'Emergency Alert',
            text: `
                Emergency for user ${user.name}
                Heart Rate: ${reading.heartRate}
                SpO2: ${reading.spO2}
                Location: ${reading.location.latitude}, ${reading.location.longitude}
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Email sent to emergency contact ${contact.name} (${contact.email})`);
        } catch (err) {
            console.error(`Error sending email to ${contact.email}:`, err);
        }

        // Send SMS
        const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        try {
            await twilioClient.messages.create({
                body: `Emergency for user ${user.name}. Location: ${reading.location.latitude}, ${reading.location.longitude}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: contact.phone
            });
            console.log(`SMS sent to emergency contact ${contact.name} (${contact.phone})`);
        } catch (err) {
            console.error(`Error sending SMS to ${contact.phone}:`, err);
        }
    }
}

// Emergency services API integration
async function callEmergencyServices(location, details) {
    // Integrate with emergency services API to dispatch responders
    const response = await fetch('https://emergency-services-api.com/dispatch', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location, details })
    });

    if (response.ok) {
        console.log('Emergency services dispatched');
    } else {
        console.error('Failed to dispatch emergency services');
    }
}

// Push notifications
async function sendPushNotifications(deviceToken, title, body) {
    // Initialize Firebase Admin SDK
    firebase.initializeApp({
        credential: firebase.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL
        })
    });

    try {
        await firebase.messaging().sendToDevice(deviceToken, {
            notification: {
                title,
                body
            }
        });
        console.log('Push notification sent');
    } catch (err) {
        console.error('Error sending push notification:', err);
    }
}

// SMS alerts
async function sendSMSAlerts(phoneNumbers, message) {
    const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    for (const number of phoneNumbers) {
        try {
            await twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: number
            });
            console.log(`SMS alert sent to ${number}`);
        } catch (err) {
            console.error(`Error sending SMS alert to ${number}:`, err);
        }
    }
}

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;