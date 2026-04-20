import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  FileText,
  MapPin,
  Calendar,
  Eye
} from 'lucide-react';

const statusConfig = {
  submitted: { color: 'bg-blue-500', icon: Clock, label: 'Submitted' },
  under_review: { color: 'bg-yellow-500', icon: AlertCircle, label: 'Under Review' },
  verified: { color: 'bg-green-500', icon: CheckCircle, label: 'Verified' },
  rejected: { color: 'bg-red-500', icon: XCircle, label: 'Rejected' },
  tender_created: { color: 'bg-purple-500', icon: FileText, label: 'Tender Created' },
  in_progress: { color: 'bg-orange-500', icon: AlertCircle, label: 'In Progress' },
  pending_admin_verification: { color: 'bg-yellow-500', icon: Clock, label: 'Pending Admin Verification' },
  completed: { color: 'bg-green-600', icon: CheckCircle, label: 'Completed' },
  resolved: { color: 'bg-green-600', icon: CheckCircle, label: 'Resolved' },
  closed: { color: 'bg-gray-500', icon: CheckCircle, label: 'Closed' },
};

const stageLabels = [
  { key: 'submittedAt', label: 'Complaint Received' },
  { key: 'officialViewedAt', label: 'Viewed by Government Official' },
  { key: 'contractorNotifiedAt', label: 'Contractor Notified' },
  { key: 'workCompletedAt', label: 'Work Completed' }
];

const ComplaintTracker = ({ complaintId }) => {
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComplaintStatus = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/citizen/complaints/${complaintId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch complaint');
        
        const data = await response.json();
        setComplaint(data.complaint);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (complaintId) {
      fetchComplaintStatus();
    }
  }, [complaintId]);

  const getStatusProgress = (status) => {
    const statusOrder = [
      'submitted',
      'under_review', 
      'verified',
      'tender_created',
      'in_progress',
      'pending_admin_verification',
      'completed',
      'resolved',
      'closed'
    ];
    
    const currentIndex = statusOrder.indexOf(status);
    return currentIndex >= 0 ? ((currentIndex + 1) / statusOrder.length) * 100 : 0;
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Loading complaint status...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-red-600 text-center">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!complaint) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6">
          <div className="text-center">Complaint not found</div>
        </CardContent>
      </Card>
    );
  }

  const statusInfo = statusConfig[complaint.status] || statusConfig.submitted;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Complaint Status
            </span>
            <Badge className={`${statusInfo.color} text-white`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-gray-500">{Math.round(getStatusProgress(complaint.status))}%</span>
            </div>
            <Progress value={getStatusProgress(complaint.status)} className="h-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Complaint ID</label>
              <p className="font-mono">{complaint.complaintId}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Category</label>
              <p className="capitalize">{complaint.category?.replace('_', ' ')}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Submitted</label>
              <p className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(complaint.submittedAt).toLocaleDateString()}
              </p>
            </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Location</label>
            <p className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {complaint.pinCode || complaint.wardNo || 'Ward N/A'}
            </p>
          </div>
        </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Title</label>
            <p className="font-semibold">{complaint.title}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-500">Description</label>
            <p className="text-gray-700">{complaint.description}</p>
          </div>

          {complaint.images && complaint.images.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-500">Evidence Images</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {complaint.images.map((image, index) => (
                  <img
                    key={index}
                    src={`http://localhost:5000${image.url}`}
                    alt={`Evidence ${index + 1}`}
                    className="w-full h-20 object-cover rounded cursor-pointer hover:opacity-80"
                    onClick={() => window.open(`http://localhost:5000${image.url}`, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}

          {complaint.reviewNotes && (
            <div>
              <label className="text-sm font-medium text-gray-500">Review Notes</label>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">{complaint.reviewNotes}</p>
            </div>
          )}

          {complaint.rejectionReason && (
            <div>
              <label className="text-sm font-medium text-gray-500">Rejection Reason</label>
              <p className="text-red-700 bg-red-50 p-3 rounded">{complaint.rejectionReason}</p>
            </div>
          )}

          {complaint.voteSummary && (
            <div>
              <label className="text-sm font-medium text-gray-500">Ward Vote Summary</label>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">
                {complaint.voteSummary.totalVotes || 0} vote(s), priority score {Number(complaint.voteSummary.averageVote || 0).toFixed(1)} / 5
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="w-full max-w-2xl mx-auto">
        <h3 className="font-semibold mb-3">Timeline</h3>
        <div className="space-y-2">
          {stageLabels.map((stage) => {
            const value = complaint.tracking?.[stage.key] || complaint[stage.key];
            const complete = Boolean(value);
            const StageIcon = complete ? CheckCircle : AlertCircle;

            return (
              <div key={stage.key} className={`flex items-center gap-3 p-3 rounded ${complete ? 'bg-green-50' : 'bg-gray-50'}`}>
                <StageIcon className={`h-5 w-5 ${complete ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <p className="font-medium">{stage.label}</p>
                  <p className="text-sm text-gray-600">{complete ? new Date(value).toLocaleString() : 'Pending'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ComplaintTracker;
