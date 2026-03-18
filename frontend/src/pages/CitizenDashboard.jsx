import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import ComplaintForm from '../components/ComplaintForm';
import MyComplaints from '../components/MyComplaints';
import { FileText, List, Plus } from 'lucide-react';

const CitizenDashboard = () => {
  const [activeTab, setActiveTab] = useState('submit');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmitComplaint = async (formData) => {
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('http://localhost:5000/api/citizen/complaints', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Complaint submitted successfully!');
        setActiveTab('my-complaints');
      } else {
        setMessage(data.message || 'Failed to submit complaint');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Citizen Dashboard</h1>
        <p className="text-gray-600">Report and track infrastructure issues in your area</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md ${
          message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="submit" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Submit Complaint
          </TabsTrigger>
          <TabsTrigger value="my-complaints" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            My Complaints
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="mt-6">
          <ComplaintForm onSubmit={handleSubmitComplaint} loading={submitting} />
        </TabsContent>

        <TabsContent value="my-complaints" className="mt-6">
          <MyComplaints />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CitizenDashboard;
