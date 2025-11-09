import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Filter,
  Building,
  Zap,
  Leaf,
  MapPin,
  GitCompare
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { MapContainer, TileLayer, Popup, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import './App.css'
import { getCurrentUser, getCurrentPlan } from '@/lib/auth'
import { Toaster } from '@/components/ui/toaster'
import { Link, useSearchParams } from 'react-router-dom'
import { buildCSV, downloadCSV } from '@/lib/utils'

// Building data type loaded from JSON
interface Building {
  id: number
  name: string
  address: string
  district: string
  greenMarkRating: string
  buildingType: string
  energyIntensity: number
  totalFloorArea: number
  yearBuilt: number
  certificationValidUntil: string
  estimatedMonthlyCost: number
  carbonSavings: number
  occupancyRate: number
  amenities: string[]
  coordinates: [number, number] // [lng, lat]
}

// Green Certification Distribution Data
const certificationData = [
  { name: 'Platinum', value: 15, color: '#10b981' },
  { name: 'GoldPLUS', value: 25, color: '#f59e0b' },
  { name: 'Gold', value: 35, color: '#eab308' },
  { name: 'Certified', value: 25, color: '#6b7280' }
]

function AuthButtons() {
  const user = getCurrentUser()
  if (user) {
    return (
      <Button asChild size='sm'>
        <Link to='/profile'>Profile</Link>
      </Button>
    )
  }
  return (
    <div className='flex items-center gap-2'>
      <Button asChild variant='outline' size='sm'>
        <Link to='/login'>Login</Link>
      </Button>
      <Button asChild size='sm'>
        <Link to='/register'>Register</Link>
      </Button>
    </div>
  )
}

// Helper component to fit map bounds to current buildings
function FitBounds({ buildings }: { buildings: Building[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    if (!buildings.length) {
      map.setView([1.29027, 103.851959], 12)
      return
    }
    const bounds = L.latLngBounds(
      buildings.map((b) => L.latLng(b.coordinates[1], b.coordinates[0]))
    )
    map.fitBounds(bounds, { padding: [20, 20] })
  }, [map, buildings])
  return null
}

function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('all')
  const [selectedRating, setSelectedRating] = useState('all')
  const [selectedType, setSelectedType] = useState('all')
  const [compareBuildings, setCompareBuildings] = useState<number[]>([])
  const [activeTab, setActiveTab] = useState('search')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  // Fix default Leaflet marker icon paths for Vite bundling
  useEffect(() => {
    const DefaultIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
    L.Marker.prototype.options.icon = DefaultIcon
  }, [])

  // Load buildings from local JSON file
  const [buildings, setBuildings] = useState<Building[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    fetch('/buildings.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Local file request failed: ${res.status}`)
        }
        return res.json()
      })
      .then((data: Building[]) => {
        console.log(
          'Successfully loaded buildings from local file:',
          data.length
        )
        setBuildings(data)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error('Failed to load local file:', error)
        setBuildings([])
        setIsLoading(false)
      })
  }, [])

  // District options derived from data
  const districtOptions = useMemo(() => {
    const set = new Set<string>()
    for (const b of buildings) {
      const d = b.district?.trim() || 'Unknown'
      set.add(d)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [buildings])

  // Rating options derived from data (normalized)
  const ratingOptions = useMemo(() => {
    const set = new Set<string>(['Platinum', 'GoldPLUS', 'Gold', 'Certified'])
    for (const b of buildings) set.add(normRating(b.greenMarkRating))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [buildings])

  // Type options derived from data (normalized)
  const typeOptions = useMemo(() => {
    const set = new Set<string>([
      'Office',
      'Retail',
      'Industrial',
      'Residential',
      'Mixed Development',
      'Institutional',
      'Hotel',
      'Data Centre',
      'Others'
    ])
    for (const b of buildings) set.add(normType(b.buildingType))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [buildings])

  // Filter Buildings
  const filteredBuildings = useMemo(() => {
    return buildings.filter((building: Building) => {
      const matchesSearch =
        building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        building.address.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDistrict =
        selectedDistrict === 'all' ||
        (building.district?.trim() || 'Unknown') === selectedDistrict
      const matchesRating =
        selectedRating === 'all' ||
        normRating(building.greenMarkRating) === selectedRating
      const matchesType =
        selectedType === 'all' ||
        normType(building.buildingType) === selectedType

      return matchesSearch && matchesDistrict && matchesRating && matchesType
    })
  }, [searchTerm, selectedDistrict, selectedRating, selectedType, buildings])

  // Pagination: compute current page slice and total pages
  const totalPages = Math.max(
    1,
    Math.ceil(filteredBuildings.length / PAGE_SIZE)
  )
  const pagedBuildings = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredBuildings.slice(start, start + PAGE_SIZE)
  }, [filteredBuildings, page])

  // Summary metrics for current filtered set
  const summary = useMemo(() => {
    const n = filteredBuildings.length
    if (n === 0) {
      return {
        count: 0,
        avgEUI: 0,
        avgCost: 0,
        avgOcc: 0,
        totalArea: 0,
        byRating: {} as Record<string, number>
      }
    }
    let sumEUI = 0
    let sumCost = 0
    let sumOcc = 0
    let sumArea = 0
    const byRating: Record<string, number> = {}
    for (const b of filteredBuildings) {
      sumEUI += b.energyIntensity
      sumCost += b.estimatedMonthlyCost
      sumOcc += b.occupancyRate
      sumArea += b.totalFloorArea
      const r = normRating(b.greenMarkRating)
      byRating[r] = (byRating[r] ?? 0) + 1
    }
    return {
      count: n,
      avgEUI: Math.round((sumEUI / n) * 10) / 10,
      avgCost: Math.round(sumCost / n),
      avgOcc: Math.round((sumOcc / n) * 10) / 10,
      totalArea: sumArea,
      byRating
    }
  }, [filteredBuildings])

  // Reset to first page when filters/search change
  useEffect(() => {
    setPage(1)
  }, [searchTerm, selectedDistrict, selectedRating, selectedType])

  // --- URL state sync for shareable links ---
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL on first render
  useEffect(() => {
    const qp = Object.fromEntries(searchParams.entries()) as Record<
      string,
      string
    >
    if (qp.q !== undefined) setSearchTerm(qp.q)
    if (qp.district !== undefined) setSelectedDistrict(qp.district)
    if (qp.rating !== undefined) setSelectedRating(qp.rating)
    if (qp.type !== undefined) setSelectedType(qp.type)
    if (qp.tab !== undefined) setActiveTab(qp.tab)
    if (qp.compare !== undefined) {
      const ids = qp.compare
        .split(',')
        .map((v) => parseInt(v, 10))
        .filter((n) => !Number.isNaN(n))
      setCompareBuildings(ids)
    }
    if (qp.page !== undefined) {
      const p = parseInt(qp.page, 10)
      if (!Number.isNaN(p)) setPage(Math.max(1, p))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep URL in sync when filters/compare/tab/page change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (selectedDistrict !== 'all') params.set('district', selectedDistrict)
    if (selectedRating !== 'all') params.set('rating', selectedRating)
    if (selectedType !== 'all') params.set('type', selectedType)
    if (activeTab) params.set('tab', activeTab)
    if (compareBuildings.length)
      params.set('compare', compareBuildings.join(','))
    if (page > 1) params.set('page', String(page))
    setSearchParams(params)
  }, [
    searchTerm,
    selectedDistrict,
    selectedRating,
    selectedType,
    compareBuildings,
    activeTab,
    page,
    setSearchParams
  ])

  // Get Rating Color (Tailwind class)
  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'Platinum':
        return 'bg-green-500'
      case 'GoldPLUS':
        return 'bg-orange-500'
      case 'Gold':
        return 'bg-yellow-500'
      case 'Certified':
        return 'bg-gray-500'
      default:
        return 'bg-gray-400'
    }
  }
  // Get Rating HEX color for map icons
  function getRatingHex(rating: string) {
    const found = certificationData.find((c) => c.name === rating)
    return found?.color ?? '#6b7280'
  }
  // Normalize helpers (use function declarations so they are hoisted)
  function normRating(r?: string) {
    const v = (r ?? '').trim()
    return v.toLowerCase() === 'goldplus' ? 'GoldPLUS' : v
  }
  function normType(t?: string) {
    return t?.trim() || 'Unknown'
  }

  // Build a small colored dot icon for markers
  const makeDotIcon = (rating: string) => {
    const color = getRatingHex(rating)
    return L.divIcon({
      className: 'marker-dot',
      html: `<span style="background:${color};width:12px;height:12px;display:block;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })
  }

  // Add/Remove Building for Comparison
  const toggleCompare = (buildingId: number) => {
    const plan = getCurrentPlan()
    const limit = plan === 'free' ? 3 : Infinity
    if (compareBuildings.includes(buildingId)) {
      setCompareBuildings(compareBuildings.filter((id) => id !== buildingId))
    } else if (compareBuildings.length < limit) {
      setCompareBuildings([...compareBuildings, buildingId])
    }
  }

  // Get Buildings for Comparison
  const buildingsToCompare = buildings.filter((b: Building) =>
    compareBuildings.includes(b.id)
  )

  // CSV export builders
  const compareCsvHeaders = [
    'Name',
    'District',
    'Rating',
    'Type',
    'EnergyIntensity',
    'MonthlyCost',
    'CarbonSavings',
    'Occupancy',
    'FloorArea'
  ]
  const compareCsvRows = buildingsToCompare.map((b) => [
    b.name,
    b.district,
    b.greenMarkRating,
    b.buildingType,
    String(b.energyIntensity),
    String(b.estimatedMonthlyCost),
    String(b.carbonSavings),
    String(b.occupancyRate),
    String(b.totalFloorArea)
  ])

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Header Navigation */}
      <header className='bg-white shadow-sm border-b'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center h-16'>
            <div className='flex items-center space-x-3'>
              <div className='flex items-center justify-center w-10 h-10 bg-green-600 rounded-lg'>
                <Leaf className='w-6 h-6 text-white' />
              </div>
              <div>
                <h1 className='text-xl font-bold text-gray-900'>
                  EcoMetricMatrix
                </h1>
                <p className='text-sm text-gray-500'>
                  Intelligent Selector for Green Buildings in Singapore
                </p>
              </div>
            </div>
            <div className='flex items-center space-x-4'>
              <Badge variant='brandOutline'>
                <Zap className='w-3 h-3 mr-1' />
                Energy Saving
              </Badge>
              <Badge variant='brandOutline'>
                <Building className='w-3 h-3 mr-1' />
                BCA Certified
              </Badge>
              {/* Auth controls: show Profile when logged in, otherwise Login/Register */}
              <div className='flex items-center gap-2'>
                <Button asChild variant='brandOutline' size='sm'>
                  <Link to='/pricing'>Pricing</Link>
                </Button>
                <AuthButtons />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'>
        {/* Main Content Area */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className='space-y-6'
        >
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='search' className='flex items-center space-x-2'>
              <Search className='w-4 h-4' />
              <span>Search Buildings</span>
            </TabsTrigger>
            <TabsTrigger
              value='compare'
              className='flex items-center space-x-2'
            >
              <GitCompare className='w-4 h-4' />
              <span>Compare Buildings</span>
            </TabsTrigger>
            <TabsTrigger value='map' className='flex items-center space-x-2'>
              <MapPin className='w-4 h-4' />
              <span>Map</span>
            </TabsTrigger>
          </TabsList>

          {/* Search and Filter Tab */}
          <TabsContent value='search' className='space-y-6'>
            {/* Search and Filter Area */}
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <Filter className='w-5 h-5' />
                  <span>Search and Filter</span>
                </CardTitle>
                <CardDescription>
                  Filter buildings by location, Green Mark rating, and building
                  type
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-4'>
                {isLoading ? (
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                    </div>
                    <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                      <Skeleton className='h-20 w-full' />
                      <Skeleton className='h-20 w-full' />
                      <Skeleton className='h-20 w-full' />
                      <Skeleton className='h-20 w-full' />
                      <Skeleton className='h-20 w-full' />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
                      <div className='relative'>
                        <Search className='absolute left-3 top-3 w-4 h-4 text-gray-400' />
                        <Input
                          placeholder='Search by building name or address...'
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className='pl-10'
                        />
                      </div>
                      <Select
                        value={selectedDistrict}
                        onValueChange={setSelectedDistrict}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select District' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Districts</SelectItem>
                          {districtOptions.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={selectedRating}
                        onValueChange={setSelectedRating}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Green Mark Rating' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Ratings</SelectItem>
                          {ratingOptions.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={selectedType}
                        onValueChange={setSelectedType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Building Type' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Types</SelectItem>
                          {typeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Summary metrics */}
                    {summary.count > 0 ? (
                      <div className='space-y-3'>
                        <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
                          <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-100'>
                            <p className='text-xs text-gray-600'>Matched</p>
                            <p className='text-sm font-semibold'>
                              {summary.count}
                            </p>
                          </div>
                          <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-100'>
                            <p className='text-xs text-gray-600'>Avg EUI</p>
                            <p className='text-sm font-semibold'>
                              {summary.avgEUI} kWh/m²/yr
                            </p>
                          </div>
                          <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-100'>
                            <p className='text-xs text-gray-600'>
                              Avg Monthly Cost
                            </p>
                            <p className='text-sm font-semibold'>
                              S${summary.avgCost.toLocaleString()}
                            </p>
                          </div>
                          <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-100'>
                            <p className='text-xs text-gray-600'>
                              Avg Occupancy
                            </p>
                            <p className='text-sm font-semibold'>
                              {summary.avgOcc}%
                            </p>
                          </div>
                          <div className='p-3 rounded-lg bg-emerald-50 border border-emerald-100'>
                            <p className='text-xs text-gray-600'>
                              Total Floor Area
                            </p>
                            <p className='text-sm font-semibold'>
                              {summary.totalArea.toLocaleString()} m²
                            </p>
                          </div>
                        </div>
                        {/* Rating distribution chips */}
                        <div className='flex flex-wrap gap-2'>
                          {Object.entries(summary.byRating).map(
                            ([r, count]) => (
                              <Badge
                                key={r}
                                variant='brandOutline'
                                className='text-xs'
                              >
                                {r}: {count}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className='p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600'>
                        No results — adjust filters to see summary.
                      </div>
                    )}
                    <div className='flex items-center justify-between'>
                      <p className='text-sm text-gray-600'>
                        Page {page} of {totalPages} (Showing{' '}
                        {pagedBuildings.length} of {filteredBuildings.length})
                      </p>
                      <div className='flex gap-2'>
                        <Button
                          variant='brandOutline'
                          size='sm'
                          onClick={() => {
                            const headers = [
                              'Name',
                              'District',
                              'Rating',
                              'Type',
                              'EnergyIntensity',
                              'MonthlyCost',
                              'CarbonSavings',
                              'Occupancy',
                              'FloorArea'
                            ]
                            const rows = filteredBuildings.map((b) => [
                              b.name,
                              b.district,
                              b.greenMarkRating,
                              b.buildingType,
                              String(b.energyIntensity),
                              String(b.estimatedMonthlyCost),
                              String(b.carbonSavings),
                              String(b.occupancyRate),
                              String(b.totalFloorArea)
                            ])
                            const csv = buildCSV(headers, rows)
                            downloadCSV(
                              `search_${filteredBuildings.length}_buildings.csv`,
                              csv
                            )
                          }}
                        >
                          Export CSV
                        </Button>
                        <Button
                          variant='brandOutline'
                          size='sm'
                          onClick={() => {
                            navigator.clipboard.writeText(window.location.href)
                          }}
                        >
                          Copy link
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          Prev
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            setPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={page >= totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Building List */}
            {isLoading ? (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card
                    key={index}
                    className='hover:shadow-lg transition-shadow'
                  >
                    <CardHeader>
                      <div className='flex justify-between items-start'>
                        <div className='flex-1'>
                          <Skeleton className='h-6 w-3/4 mb-2' />
                          <Skeleton className='h-4 w-1/2' />
                        </div>
                        <Skeleton className='h-6 w-20' />
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <Skeleton className='h-4 w-full mb-2' />
                          <Skeleton className='h-5 w-2/3' />
                        </div>
                        <div>
                          <Skeleton className='h-4 w-full mb-2' />
                          <Skeleton className='h-5 w-2/3' />
                        </div>
                        <div>
                          <Skeleton className='h-4 w-full mb-2' />
                          <Skeleton className='h-5 w-2/3' />
                        </div>
                        <div>
                          <Skeleton className='h-4 w-full mb-2' />
                          <Skeleton className='h-5 w-2/3' />
                        </div>
                      </div>
                      <div className='flex flex-wrap gap-1'>
                        <Skeleton className='h-5 w-16' />
                        <Skeleton className='h-5 w-20' />
                        <Skeleton className='h-5 w-14' />
                      </div>
                      <div className='flex space-x-2'>
                        <Skeleton className='h-9 flex-1' />
                        <Skeleton className='h-9 w-24' />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                {pagedBuildings.map((building) => (
                  <Card
                    key={building.id}
                    className='hover:shadow-lg transition-shadow'
                  >
                    <CardHeader>
                      <div className='flex justify-between items-start'>
                        <div>
                          <CardTitle className='text-lg'>
                            {building.name}
                          </CardTitle>
                          <CardDescription className='flex items-center mt-1'>
                            <MapPin className='w-3 h-3 mr-1' />
                            {building.district}
                          </CardDescription>
                        </div>
                        <Badge
                          className={`${getRatingColor(
                            building.greenMarkRating
                          )} text-white`}
                        >
                          {building.greenMarkRating}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-4'>
                      <div className='grid grid-cols-2 gap-4 text-sm'>
                        <div>
                          <p className='text-gray-500'>Energy Intensity</p>
                          <p className='font-semibold'>
                            {building.energyIntensity} kWh/m²/year
                          </p>
                        </div>
                        <div>
                          <p className='text-gray-500'>Est. Monthly Cost</p>
                          <p className='font-semibold'>
                            S${building.estimatedMonthlyCost.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className='text-gray-500'>Carbon Savings</p>
                          <p className='font-semibold text-green-600'>
                            {building.carbonSavings}%
                          </p>
                        </div>
                        <div>
                          <p className='text-gray-500'>Occupancy Rate</p>
                          <p className='font-semibold'>
                            {building.occupancyRate}%
                          </p>
                        </div>
                      </div>

                      <div className='flex flex-wrap gap-1'>
                        {building.amenities.map((amenity, index) => (
                          <Badge
                            key={index}
                            variant='secondary'
                            className='text-xs'
                          >
                            {amenity}
                          </Badge>
                        ))}
                      </div>

                      <div className='flex space-x-2'>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant='outline'
                              size='sm'
                              className='flex-1'
                            >
                              View Details
                            </Button>
                          </DialogTrigger>
                          <DialogContent className='max-w-2xl'>
                            <DialogHeader>
                              <DialogTitle>{building.name}</DialogTitle>
                              <DialogDescription>
                                {building.address}
                              </DialogDescription>
                            </DialogHeader>
                            <div className='grid grid-cols-2 gap-4 py-4'>
                              <div className='space-y-3'>
                                <div>
                                  <h4 className='font-semibold text-sm text-gray-700'>
                                    Basic Information
                                  </h4>
                                  <div className='mt-2 space-y-1 text-sm'>
                                    <p>
                                      <span className='text-gray-500'>
                                        Building Type:{' '}
                                      </span>
                                      {building.buildingType}
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Year Built:{' '}
                                      </span>
                                      {building.yearBuilt}
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Total Floor Area:{' '}
                                      </span>
                                      {building.totalFloorArea.toLocaleString()}{' '}
                                      m²
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Certification Valid Until:{' '}
                                      </span>
                                      {building.certificationValidUntil}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className='space-y-3'>
                                <div>
                                  <h4 className='font-semibold text-sm text-gray-700'>
                                    Energy Efficiency
                                  </h4>
                                  <div className='mt-2 space-y-1 text-sm'>
                                    <p>
                                      <span className='text-gray-500'>
                                        Energy Intensity:{' '}
                                      </span>
                                      {building.energyIntensity} kWh/m²/year
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Carbon Savings:{' '}
                                      </span>
                                      <span className='text-green-600'>
                                        {building.carbonSavings}%
                                      </span>
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Occupancy Rate:{' '}
                                      </span>
                                      {building.occupancyRate}%
                                    </p>
                                    <p>
                                      <span className='text-gray-500'>
                                        Est. Monthly Cost:{' '}
                                      </span>
                                      S$
                                      {building.estimatedMonthlyCost.toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant={
                            compareBuildings.includes(building.id)
                              ? 'default'
                              : 'outline'
                          }
                          size='sm'
                          onClick={() => toggleCompare(building.id)}
                          disabled={
                            !compareBuildings.includes(building.id) &&
                            compareBuildings.length >=
                              (getCurrentPlan() === 'free' ? 3 : Infinity)
                          }
                        >
                          {compareBuildings.includes(building.id)
                            ? 'Selected'
                            : 'Compare'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && filteredBuildings.length === 0 && (
              <Card>
                <CardContent className='text-center py-12'>
                  <Building className='w-12 h-12 text-gray-400 mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                    No matching buildings found
                  </h3>
                  <p className='text-gray-500'>
                    Please try adjusting your search or filter criteria
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Building Comparison Tab */}
          <TabsContent value='compare' className='space-y-6'>
            {buildingsToCompare.length === 0 ? (
              <Card>
                <CardContent className='text-center py-12'>
                  <GitCompare className='w-12 h-12 text-gray-400 mx-auto mb-4' />
                  <h3 className='text-lg font-semibold text-gray-600 mb-2'>
                    Please select buildings to compare
                  </h3>
                  <p className='text-gray-500 mb-4'>
                    {getCurrentPlan() === 'free'
                      ? 'Select up to 3 buildings from the search page to compare'
                      : 'Select buildings from the search page to compare (unlimited)'}
                  </p>
                  <Button onClick={() => setActiveTab('search')}>
                    Go to Search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className='space-y-6'>
                <Card>
                  <CardHeader className='flex items-center justify-between'>
                    <div>
                      <CardTitle>Building Comparison Analysis</CardTitle>
                      <CardDescription>
                        Comparing {buildingsToCompare.length} buildings
                      </CardDescription>
                    </div>
                    <div className='flex gap-2'>
                      <Button
                        variant='brandOutline'
                        size='sm'
                        onClick={() => {
                          const csv = buildCSV(
                            compareCsvHeaders,
                            compareCsvRows
                          )
                          downloadCSV(
                            `comparison_${buildingsToCompare.length}_buildings.csv`,
                            csv
                          )
                        }}
                      >
                        Export CSV
                      </Button>
                      <Button
                        variant='brandOutline'
                        size='sm'
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.href)
                        }}
                      >
                        Copy link
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className='overflow-x-auto'>
                      <table className='w-full'>
                        <thead>
                          <tr className='border-b'>
                            <th className='text-left py-2 px-4'>Metric</th>
                            {buildingsToCompare.map((building) => (
                              <th
                                key={building.id}
                                className='text-left py-2 px-4'
                              >
                                {building.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className='text-sm'>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Green Mark Rating
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                <Badge
                                  className={`${getRatingColor(
                                    building.greenMarkRating
                                  )} text-white`}
                                >
                                  {building.greenMarkRating}
                                </Badge>
                              </td>
                            ))}
                          </tr>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Energy Intensity
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                {building.energyIntensity} kWh/m²/year
                              </td>
                            ))}
                          </tr>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Est. Monthly Cost
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                S$
                                {building.estimatedMonthlyCost.toLocaleString()}
                              </td>
                            ))}
                          </tr>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Carbon Savings
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td
                                key={building.id}
                                className='py-2 px-4 text-green-600'
                              >
                                {building.carbonSavings}%
                              </td>
                            ))}
                          </tr>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Occupancy Rate
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                {building.occupancyRate}%
                              </td>
                            ))}
                          </tr>
                          <tr className='border-b'>
                            <td className='py-2 px-4 font-medium'>
                              Floor Area
                            </td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                {building.totalFloorArea.toLocaleString()} m²
                              </td>
                            ))}
                          </tr>
                          <tr>
                            <td className='py-2 px-4 font-medium'>District</td>
                            {buildingsToCompare.map((building) => (
                              <td key={building.id} className='py-2 px-4'>
                                {building.district}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Comparison Charts */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Energy Intensity Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width='100%' height={200}>
                        <BarChart data={buildingsToCompare}>
                          <CartesianGrid strokeDasharray='3 3' />
                          <XAxis dataKey='name' tick={{ fontSize: 12 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey='energyIntensity' fill='#059669' />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className='text-lg'>
                        Monthly Cost Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width='100%' height={200}>
                        <BarChart data={buildingsToCompare}>
                          <CartesianGrid strokeDasharray='3 3' />
                          <XAxis dataKey='name' tick={{ fontSize: 12 }} />
                          <YAxis />
                          <Tooltip />
                          <Bar
                            dataKey='estimatedMonthlyCost'
                            fill='#10b981'
                            stroke='#065f46'
                            strokeWidth={1}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Map Tab */}
          <TabsContent value='map' className='space-y-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center space-x-2'>
                  <MapPin className='w-5 h-5' />
                  <span>Singapore Map</span>
                </CardTitle>
                <CardDescription>
                  Click markers to view building details
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className='space-y-4'>
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-4'>
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                      <Skeleton className='h-10 w-full' />
                    </div>
                    <Skeleton className='h-[500px] w-full' />
                  </div>
                ) : (
                  <>
                    {/* Map Filters */}
                    <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 relative z-50'>
                      <div className='relative'>
                        <Search className='absolute left-3 top-3 w-4 h-4 text-gray-400' />
                        <Input
                          placeholder='Search by name or address...'
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className='pl-10'
                        />
                      </div>
                      <Select
                        value={selectedDistrict}
                        onValueChange={setSelectedDistrict}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Select District' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Districts</SelectItem>
                          {districtOptions.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={selectedRating}
                        onValueChange={setSelectedRating}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Green Mark Rating' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Ratings</SelectItem>
                          {ratingOptions.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={selectedType}
                        onValueChange={setSelectedType}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder='Building Type' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='all'>All Types</SelectItem>
                          {typeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='h-[500px] w-full relative'>
                      <MapContainer
                        center={[1.29027, 103.851959]}
                        zoom={12}
                        className='h-full w-full z-0'
                      >
                        {/* Fit bounds helper tied to filteredBuildings */}
                        <FitBounds buildings={filteredBuildings} />
                        <TileLayer
                          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                          attribution='&copy; OpenStreetMap contributors'
                        />
                        <MarkerClusterGroup
                          chunkedLoading
                          spiderfyOnMaxZoom
                          showCoverageOnHover={false}
                          maxClusterRadius={60}
                        >
                          {filteredBuildings.map((b) => (
                            <Marker
                              key={b.id}
                              position={[b.coordinates[1], b.coordinates[0]]}
                              icon={makeDotIcon(b.greenMarkRating)}
                            >
                              <Popup>
                                <div className='space-y-1'>
                                  <p className='font-semibold'>{b.name}</p>
                                  <p className='text-xs text-gray-600'>
                                    {b.address}
                                  </p>
                                  <p className='text-xs'>
                                    District: {b.district}
                                  </p>
                                  <p className='text-xs'>
                                    Energy Intensity: {b.energyIntensity}{' '}
                                    kWh/m²/year
                                  </p>
                                  <p className='text-xs'>
                                    Est. Monthly Cost: S$
                                    {b.estimatedMonthlyCost.toLocaleString()}
                                  </p>
                                  <div className='mt-2 flex gap-2 items-center'>
                                    <Badge
                                      className={`${getRatingColor(
                                        b.greenMarkRating
                                      )} text-white`}
                                    >
                                      {b.greenMarkRating}
                                    </Badge>
                                    <Button
                                      variant={
                                        compareBuildings.includes(b.id)
                                          ? 'default'
                                          : 'outline'
                                      }
                                      size='sm'
                                      onClick={() => toggleCompare(b.id)}
                                      disabled={
                                        !compareBuildings.includes(b.id) &&
                                        compareBuildings.length >=
                                          (getCurrentPlan() === 'free'
                                            ? 3
                                            : Infinity)
                                      }
                                    >
                                      {compareBuildings.includes(b.id)
                                        ? 'Selected'
                                        : 'Compare'}
                                    </Button>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          ))}
                        </MarkerClusterGroup>
                      </MapContainer>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className='bg-gray-800 text-white mt-12'>
        <div className='max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-8'>
            <div>
              <h3 className='font-semibold'>About EcoMetricMatrix</h3>
              <p className='text-sm text-gray-400'>
                A tool to help tenants and SMEs make informed decisions based on
                BCA Green Mark ratings and energy data.
              </p>
            </div>
            <div>
              <h3 className='font-semibold'>Data Sources</h3>
              <ul className='text-sm text-gray-400 space-y-2 mt-2'>
                <li>
                  <a href='#' className='hover:text-white'>
                    BCA Green Mark Buildings
                  </a>
                </li>
                <li>
                  <a href='#' className='hover:text-white'>
                    Building Energy Performance Data
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className='font-semibold'>Contact Us</h3>
              <ul className='text-sm text-gray-400 space-y-2 mt-2'>
                <li>
                  <a href='#' className='hover:text-white'>
                    Feedback
                  </a>
                </li>
                <li>
                  <a href='#' className='hover:text-white'>
                    Partnerships
                  </a>
                </li>
              </ul>
            </div>
            <div className='text-right'>
              <p className='text-sm text-gray-400 mt-8 md:mt-0'>
                &copy; 2025 EcoMetricMatrix. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  )
}

export default App
