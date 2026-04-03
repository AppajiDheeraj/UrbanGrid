import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Calendar
} from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    inProgress: 0,
    completed: 0,
    rejected: 0
  });
  const [recentComplaints, setRecentComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/admin/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setRecentComplaints(data.recentComplaints);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Complaints', value: stats.total, icon: FileText, color: 'bg-blue-500' },
    { title: 'Pending Review', value: stats.pending, icon: Clock, color: 'bg-yellow-500' },
    { title: 'Verified', value: stats.verified, icon: CheckCircle, color: 'bg-green-500' },
    { title: 'In Progress', value: stats.inProgress, icon: AlertTriangle, color: 'bg-orange-500' },
    { title: 'Completed', value: stats.completed, icon: CheckCircle, color: 'bg-green-600' },
    { title: 'Rejected', value: stats.rejected, icon: AlertTriangle, color: 'bg-red-500' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-600">Manage and verify infrastructure complaints</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Recent Complaints
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentComplaints.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent complaints</p>
              ) : (
                recentComplaints.map((complaint) => (
                  <div key={complaint._id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm text-gray-500">{complaint.complaintId}</span>
                          <Badge className={
                            complaint.status === 'submitted' ? 'bg-blue-500' :
                            complaint.status === 'verified' ? 'bg-green-500' :
                            complaint.status === 'rejected' ? 'bg-red-500' : 'bg-gray-500'
                          }>
                            {complaint.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <h4 className="font-semibold">{complaint.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {complaint.citizen?.name} • {complaint.category?.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          {new Date(complaint.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => window.location.href = '/dashboard'}
              >
                <Clock className="h-4 w-4 mr-2" />
                Review Pending Complaints
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => window.location.href = '/dashboard'}
              >
                <FileText className="h-4 w-4 mr-2" />
                View All Complaints
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => window.location.href = '/dashboard'}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Generate Reports
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
