import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { register as registerUser } from '@/lib/auth'
import { useToast } from '@/hooks/use-toast'

interface RegisterFields {
  name?: string
  email: string
  password: string
  confirm: string
}

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<RegisterFields>({
    mode: 'onChange'
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  const onSubmit = (data: RegisterFields) => {
    // basic password rule: >=8, must contain letters and digits
    const pass = data.password
    const strong = pass.length >= 8 && /[A-Za-z]/.test(pass) && /\d/.test(pass)
    if (!strong) {
      setError('password', {
        type: 'validate',
        message:
          'Password must be at least 8 characters and include letters and digits'
      })
      toast({
        title: 'Password invalid',
        description: 'At least 8 characters, include letters and digits',
        variant: 'destructive'
      })
      return
    }
    if (data.password !== data.confirm) {
      setError('confirm', {
        type: 'validate',
        message: 'Passwords do not match'
      })
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    const res = registerUser(data.email, data.password, data.name)
    if (!res.ok) {
      toast({
        title: 'Registration failed',
        description: res.error,
        variant: 'destructive'
      })
      return
    }
    toast({ title: 'Registration successful', description: res.user.email })
    navigate('/', { replace: true })
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
      <Card className='w-full max-w-md'>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Start using EcoMetricMatrix</CardDescription>
        </CardHeader>
        <CardContent>
          <form className='space-y-4' onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className='text-sm font-medium'>Name</label>
              <Input
                type='text'
                placeholder='Your name'
                {...register('name')}
              />
            </div>
            <div>
              <label className='text-sm font-medium'>Email</label>
              <Input
                type='email'
                placeholder='you@example.com'
                {...register('email', { required: true })}
              />
            </div>
            <div>
              <label className='text-sm font-medium'>Password</label>
              <Input
                type='password'
                placeholder='At least 8 chars, letters and digits'
                {...register('password', {
                  required: 'Please enter password',
                  minLength: { value: 8, message: 'At least 8 characters' }
                })}
              />
              {errors.password && (
                <p className='text-xs text-red-600 mt-1'>
                  {errors.password.message as string}
                </p>
              )}
            </div>
            <div>
              <label className='text-sm font-medium'>Confirm Password</label>
              <Input
                type='password'
                placeholder='Re-enter password'
                {...register('confirm', {
                  required: 'Please confirm password'
                })}
              />
              {errors.confirm && (
                <p className='text-xs text-red-600 mt-1'>
                  {errors.confirm.message as string}
                </p>
              )}
            </div>
            <Button type='submit' className='w-full'>
              Register
            </Button>
            <p className='text-xs text-gray-500 text-center'>
              Already have an account?{' '}
              <Link to='/login' className='text-blue-600'>
                Login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
