import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCurrentPlan, setCurrentPlan, type PlanTier } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'
import { useNavigate } from 'react-router-dom'
import { getCurrentUser } from '@/lib/auth'

const PLANS: Array<{
  tier: PlanTier
  price: string
  subtitle: string
  features: string[]
  recommended?: boolean
}> = [
  {
    tier: 'free',
    price: 'SGD 0',
    subtitle: 'Rate-limited search, basic compare and PNG export',
    features: [
      'Rate limited search + map',
      'Compare up to 3 buildings',
      'Basic bill/CO₂ estimate',
      'PNG export',
    ],
  },
  {
    tier: 'pro',
    price: 'SGD 19 / user / mo',
    subtitle: 'Unlimited compare, CSV/PDF export, saved portfolios',
    features: [
      'Unlimited compare',
      'CSV export',
      'Saved portfolios',
      'Certificate expiry alerts',
      'Custom tariffs',
      'PDF reporting with logo',
    ],
    recommended: true,
  },
  {
    tier: 'team',
    price: 'SGD 79 / 5 users / mo',
    subtitle: 'Shared portfolios, Pro-level access for all users',
    features: [
      'Shared portfolios',
      'Pro-level access for all users',
      'Team management',
    ],
  },
  {
    tier: 'api',
    price: 'from SGD 199 / mo',
    subtitle: 'Embed ratings & estimates for portals/landlords',
    features: [
      'Embeddable ratings & estimates',
      'JSON API access',
      'Usage-based pricing',
    ],
  },
]

export default function Pricing() {
  const user = getCurrentUser()
  const navigate = useNavigate()
  const { toast } = useToast()
  const current = getCurrentPlan()

  const choosePlan = (tier: PlanTier) => {
    if (!user) {
      toast({ title: 'Please log in', description: 'Login required to select a plan.' })
      navigate('/login')
      return
    }
    setCurrentPlan(tier)
    toast({ title: 'Plan updated', description: `Switched to ${tier.toUpperCase()}.` })
    navigate('/profile')
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">Choose your plan</h1>
            <p className="text-emerald-700 mt-2">Upgrade to unlock more features. This is a local-only demo checkout.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="brandOutline" onClick={() => navigate('/')}>Back to Home</Button>
            <Button variant="brandOutline" onClick={() => navigate('/profile')}>Back to Profile</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((p) => (
            <Card key={p.tier} className={(p.recommended ? 'border-2 border-green-500 ' : '') + 'h-full flex flex-col'}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="uppercase text-sm">{p.tier}</CardTitle>
                  {p.recommended && (
                    <Badge variant="brandOutline">Recommended</Badge>
                  )}
                </div>
                <CardDescription>{p.subtitle}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex flex-col flex-1">
                <div className="text-2xl font-bold">{p.price}</div>
                <ul className="text-sm text-gray-700 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f}>• {f}</li>
                  ))}
                </ul>
                <div className="mt-auto">
                  <Button
                    variant={current === p.tier ? 'default' : 'outline'}
                    className="w-full"
                    onClick={() => choosePlan(p.tier)}
                  >
                    {current === p.tier ? 'Current plan' : `Choose ${p.tier.toUpperCase()}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
