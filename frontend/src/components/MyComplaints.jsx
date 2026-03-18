import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Search,
  Eye,
  MapPin,
  Calendar
} from 'lucide-react';
import ComplaintTracker from './ComplaintTracker';

const statusConfig = {
  submitted: { color: 'bg-blue-500', icon: Clock, label: 'Submitted' },
  under_review: { color: 'bg-yellow-500', icon: AlertCircle, label: 'Under Review' },
  verified: { color: 'bg-green-500', icon: CheckCircle, label: 'Verified' },
  rejected: { color: 'bg-red-500', icon: XCircle, label: 'Rejected' },
  tender_created: { color: 'bg-purple-500', icon: FileText, label: 'Tender Created' },
  in_progress: { color: 'bg-orange-500', icon: AlertCircle, label: 'In Progress' },
  completed: { color: 'bg-green-600', icon: CheckCircle, label: 'Completed' },
  closed: { color: 'bg-gray-500', icon: CheckCircle, label: 'Closed' },
};

const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [filteredComplaints, setFilteredComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComplaint, setSelectedComplaint] = useState(null);

  useEffect(() => {
    fetchMyComplaints();
  }, []);

  useEffect(() => {
    const filtered = complaints.filter(complaint =>
      complaint.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.complaintId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      complaint.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredComplaints(filtered);
  }, [searchTerm, complaints]);

  const fetchMyComplaints = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/citizen/complaints/my', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch complaints');
      
      const data = await response.json();
      setComplaints(data.complaints);
      setFilteredComplaints(data.complaints);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading your complaints...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardContent className="p-6">
          <div className="text-red-600 text-center">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (selectedComplaint) {
    return (
      <div>
        <Button 
          onClick={() => setSelectedComplaint(null)}
          className="mb-4"
        >
          ← Back to My Complaints
        </Button>
        <ComplaintTracker complaintId={selectedComplaint} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            My Complaints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by title, ID, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredComplaints.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No complaints found matching your search.' : 'You haven\'t submitted any complaints yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComplaints.map((complaint) => {
                const statusInfo = statusConfig[complaint.status] || statusConfig.submitted;
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={complaint._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-mono text-sm text-gray-500">{complaint.complaintId}</span>
                            <Badge className={`${statusInfo.color} text-white`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          
                          <h3 className="font-semibold text-lg mb-2">{complaint.title}</h3>
                          <p className="text-gray-600 mb-3 line-clamp-2">{complaint.description}</p>
                          
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {complaint.pinCode}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {new Date(complaint.submittedAt).toLocaleDateString()}
                            </span>
                            <span className="capitalize">
                              {complaint.category?.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedComplaint(complaint._id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MyComplaints;
