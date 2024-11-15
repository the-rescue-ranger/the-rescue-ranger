import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import axios from 'axios';

// Navigation Component
const Navigation = () => (
  <nav className="bg-blue-600 p-4">
    <div className="container mx-auto flex justify-between items-center">
      <h1 className="text-white text-2xl font-bold">Rescue Ranger</h1>
      <div className="space-x-4">
        <Link className="text-white hover:text-blue-200" to="/">Home</Link>
        <Link className="text-white hover:text-blue-200" to="/status">Status</Link>
        <Link className="text-white hover:text-blue-200" to="/emergency">Emergency</Link>
        <Link className="text-white hover:text-blue-200" to="/source">Source Code</Link>
        <Link className="text-white hover:text-blue-200" to="/about">About Us</Link>
      </div>
    </div>
  </nav>
);

// Home Page with Animation
const Home = () => (
  <div className="min-h-screen bg-gradient-to-b from-blue-100 to-blue-200">
    <div className="container mx-auto py-16 text-center">
      <h1 className="text-6xl font-bold mb-8 animate-bounce">
        Welcome to Rescue Ranger
      </h1>
      <p className="text-xl mb-8 animate-fade-in">
        Monitoring health and safety in real-time
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">Health Monitoring</h2>
          <p>Real-time heart rate and SpO2 monitoring</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">Location Tracking</h2>
          <p>GPS-based location monitoring</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-300">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">Emergency Response</h2>
          <p>Immediate alert system for critical situations</p>
        </div>
      </div>
    </div>
  </div>
);

// Status Page with Maps and Health Data
const Status = () => {
  const [healthData, setHealthData] = useState([]);
  const [location, setLocation] = useState({ lat: 0, lng: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/readings/latest');
        setHealthData(prevData => [...prevData, {
          timestamp: new Date(response.data.timestamp).toLocaleTimeString(),
          heartRate: response.data.heartRate,
          spO2: response.data.spO2
        }].slice(-10)); // Keep last 10 readings

        setLocation({
          lat: response.data.location.latitude,
          lng: response.data.location.longitude
        });

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    // Initial fetch
    fetchData();

    // Update every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error) return (
    <div className="text-center text-red-600 p-4">
      Error: {error}
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Health Metrics Card */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">Health Metrics</h2>
          <LineChart width={500} height={300} data={healthData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="heartRate" 
              stroke="#8884d8" 
              name="Heart Rate (BPM)"
            />
            <Line 
              type="monotone" 
              dataKey="spO2" 
              stroke="#82ca9d" 
              name="SpO2 (%)"
            />
          </LineChart>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h3 className="font-bold text-blue-600">Heart Rate</h3>
              <p className="text-2xl">{healthData[healthData.length - 1]?.heartRate || '--'} BPM</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h3 className="font-bold text-green-600">SpO2</h3>
              <p className="text-2xl">{healthData[healthData.length - 1]?.spO2 || '--'}%</p>
            </div>
          </div>
        </div>

        {/* Location Card */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-blue-600">Current Location</h2>
          <div className="relative w-full h-[400px]">
            <iframe
              className="w-full h-full rounded-lg"
              src={`https://www.google.com/maps/embed?pb=&q=${location.lat},${location.lng}&z=15`}
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>Latitude: {location.lat.toFixed(6)}</p>
            <p>Longitude: {location.lng.toFixed(6)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Emergency Page
const Emergency = () => {
  const [status, setStatus] = useState('normal');
  const [lastReading, setLastReading] = useState({
    heartRate: 0,
    spO2: 0
  });

  useEffect(() => {
    const fetchLatestReadings = async () => {
      try {
        const response = await axios.get('/api/readings/latest');
        setLastReading(response.data);

        // Emergency algorithm
        if (response.data.heartRate > 100 || response.data.heartRate < 60 || response.data.spO2 < 95) {
          setStatus('emergency');
          await axios.post('/api/emergency', response.data); // Send emergency notification to the server
        } else {
          setStatus('normal');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchLatestReadings();
    const interval = setInterval(fetchLatestReadings, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto p-8">
      <div className={`p-8 rounded-lg ${
        status === 'emergency' ? 'bg-red-100' : 'bg-green-100'
      }`}>
        <h2 className="text-2xl font-bold mb-4 text-center">
          Status: {status.toUpperCase()}
        </h2>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="text-center p-4 bg-white rounded-lg shadow">
            <h3 className="font-bold text-gray-700">Heart Rate</h3>
            <p className="text-2xl">{lastReading.heartRate} BPM</p>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow">
            <h3 className="font-bold text-gray-700">SpO2</h3>
            <p className="text-2xl">{lastReading.spO2}%</p>
          </div>
        </div>
        {status === 'emergency' && (
          <div className="mt-6 p-4 bg-red-200 rounded-lg text-red-700">
            <h3 className="font-bold mb-2">Emergency Protocol Activated</h3>
            <p>Emergency contacts have been notified.</p>
            <p>Please remain calm and wait for assistance.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/status" element={<Status />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route path="/source" element={
            <div className="container mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">Source Code</h2>
              <a 
                href="https://github.com/the-rescue-ranger/rescue-ranger"
                className="text-blue-600 hover:text-blue-800"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
              </a>
            </div>
          } />
          <Route path="/about" element={
            <div className="container mx-auto p-8">
              <h2 className="text-2xl font-bold mb-4">About Rescue Ranger</h2>
              <p className="text-lg text-gray-700">
                Rescue Ranger is a real-time health monitoring system designed to keep track of vital signs
                and location data to ensure timely emergency response when needed.
              </p>
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
};

export default App;