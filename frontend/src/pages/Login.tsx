import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { login } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'

interface LoginFields {
  email: string
  password: string
}

export default function Login() {
  const { register: reg, handleSubmit, formState: { errors }, setError } = useForm<LoginFields>({ mode: 'onChange' })
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = (data: LoginFields) => {
    const res = login(data.email, data.password)
    if (!res.ok) {
      setError('email', { type: 'validate', message: 'Account not found or incorrect password' })
      setError('password', { type: 'validate', message: 'Account not found or incorrect password' })
      toast({ title: 'Login failed', description: 'Account not found or incorrect password', variant: 'destructive' })
      return
    }
    toast({ title: 'Welcome', description: res.user.email })
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Sign in to GreenBuildings SG</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input type="email" placeholder="you@example.com" {...reg('email', { required: 'Please enter email' })} />
              {errors.email && (<p className="text-xs text-red-600 mt-1">{errors.email.message as string}</p>)}
            </div>
            <div>
              <label className="text-sm font-medium">Password</label>
              <Input type="password" placeholder="••••••••" {...reg('password', { required: 'Please enter password' })} />
              {errors.password && (<p className="text-xs text-red-600 mt-1">{errors.password.message as string}</p>)}
            </div>
            <Button type="submit" className="w-full">Login</Button>
            <p className="text-xs text-gray-500 text-center">
              No account? <Link to="/register" className="text-blue-600">Register</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
