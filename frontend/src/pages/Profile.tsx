import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getCurrentUser, logout, getCurrentPlan } from '@/lib/auth'
import { Navigate, useNavigate } from 'react-router-dom'

const PLAN_LABELS = { free: 'Free', pro: 'Pro', team: 'Team', api: 'API' } as const

export default function Profile() {
  const user = getCurrentUser()
  const navigate = useNavigate()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const plan = getCurrentPlan()
  const initials = (user.name ?? user.email).slice(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hero */}
        <Card className="overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500" />
          <CardContent className="p-6 -mt-10">
            <div className="flex items-start gap-4">
              <Avatar className="w-16 h-16 ring-4 ring-white shadow-md">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-emerald-700 to-teal-600 bg-clip-text text-transparent">{user.name ?? user.email}</h2>
                  <Badge variant="brand" className="uppercase">{PLAN_LABELS[plan as keyof typeof PLAN_LABELS]}</Badge>
                </div>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="brandOutline" onClick={() => navigate('/')}>Back to Home</Button>
                <Button variant="brand" onClick={() => navigate('/pricing')}>Upgrade plan</Button>
                <Button variant="destructive" onClick={() => { logout(); navigate('/login') }}>Sign out</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* Account */}
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account details</CardTitle>
                <CardDescription>Basic profile information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <Input value={user.email} readOnly />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Name</label>
                    <Input value={user.name ?? ''} readOnly />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Local demo only — editing profile is disabled.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing */}
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Plan & billing</CardTitle>
                <CardDescription>Manage your subscription (local-only demo)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Current plan</p>
                    <p className="text-lg font-semibold">{PLAN_LABELS[plan as keyof typeof PLAN_LABELS]}</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate('/pricing')}>Change plan</Button>
                </div>
                <ul className="text-sm text-gray-700 list-disc pl-5">
                  <li>Invoices & payments are simulated</li>
                  <li>No backend calls; data stored in localStorage</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Session & authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Session</p>
                    <p className="text-sm">Local session (demo)</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Account ID</p>
                    <p className="text-sm">{user.id}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" onClick={() => { logout(); navigate('/login') }}>Sign out</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription>Last actions in this session</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p>• Viewed pricing</p>
                  <p>• Browsed buildings list</p>
                  <p>• Compared 2 buildings</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
