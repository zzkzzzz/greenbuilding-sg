#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises'
import { parse } from 'csv-parse/sync'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const SHOULD_LOG = !/^(0|false)$/i.test(process.env.LOG_PROGRESS || '1')

function synthEnergyIntensity(rating) {
  switch (rating) {
    case 'Platinum': return Math.round(80 + Math.random() * 25) // 80-105
    case 'GoldPLUS': return Math.round(100 + Math.random() * 25) // 100-125
    case 'Gold': return Math.round(145 + Math.random() * 35) // 145-180
    case 'Certified': return Math.round(160 + Math.random() * 25) // 160-185
    default: return Math.round(150 + Math.random() * 40)
  }
}

function synthFloorAreaByType(type, fallback = 0) {
  if (fallback && !Number.isNaN(fallback)) return fallback
  switch (type) {
    case 'Office': return Math.round(10000 + Math.random() * 60000)
    case 'Retail': return Math.round(30000 + Math.random() * 90000)
    case 'Industrial': return Math.round(20000 + Math.random() * 100000)
    case 'Data Centre': return Math.round(30000 + Math.random() * 80000)
    default: return Math.round(15000 + Math.random() * 60000)
  }
}

function synthCarbonSavings(rating) {
  switch (rating) {
    case 'Platinum': return Math.round(40 + Math.random() * 12)
    case 'GoldPLUS': return Math.round(30 + Math.random() * 10)
    case 'Gold': return Math.round(20 + Math.random() * 10)
    case 'Certified': return Math.round(10 + Math.random() * 10)
    default: return Math.round(15 + Math.random() * 15)
  }
}

function amenitiesForType(type) {
  switch (type) {
    case 'Office': return ['Direct MRT Access', 'Parking', 'F&B']
    case 'Retail': return ['Direct MRT Access', 'Parking', 'F&B', 'Entertainment']
    case 'Industrial': return ['Parking', 'Loading Bay']
    case 'Data Centre': return ['Backup Power', 'Security', 'Cooling Systems']
    default: return ['Parking', 'F&B']
  }
}

function pickDistrict(addr, displayName, hintName, postal) {
  const GENERIC = /^(Singapore|Republic of Singapore|Central Singapore|South East|North East|North West|South West)$/i
  const KNOWN = [
    'Ang Mo Kio','Bedok','Bishan','Bukit Batok','Bukit Merah','Bukit Panjang','Bukit Timah',
    'Changi','Choa Chu Kang','Clementi','Downtown Core','Geylang','Hougang','Jurong East','Jurong West',
    'Kallang','Marine Parade','Novena','Outram','Queenstown','River Valley','Rochor','Toa Payoh',
    'Serangoon','Sembawang','Woodlands','Yishun','Tampines','Pasir Ris','Punggol','Seletar','Tuas','Boon Lay',
    'Katong','Siglap','Newton','Orchard','Bugis','Marina Bay','Tanjong Pagar','Telok Ayer','Raffles Place','Shenton Way','Balestier','Jalan Besar','Lavender'
  ]
  const CANON = new Map([
    ['Marina','Marina Bay'],
    ['Marina South','Marina Bay'],
    ['Jurong','Jurong East'],
    ['CBD','Downtown Core'],
    ['Raffles','Raffles Place'],
    ['Tanjong','Tanjong Pagar'],
  ])
  const normalize = (s) => (s || '').trim().replace(/\s+/g,' ')
  const canonicalize = (s) => {
    const x = normalize(s)
    const m = CANON.get(x) || CANON.get(x.split(' ').slice(0,2).join(' '))
    return m || x
  }
  const pri = [
    addr?.city_district,
    addr?.suburb,
    addr?.neighbourhood,
    addr?.municipality,
    addr?.quarter,
    addr?.borough,
    addr?.town,
    addr?.village,
    addr?.county,
    addr?.region,
    addr?.state_district,
  ].map(normalize).filter(v => v && !GENERIC.test(v))
  for (const v of pri) {
    const c = canonicalize(v)
    if (KNOWN.some(k => k.toLowerCase() === c.toLowerCase())) return c
  }
  const tokens = [
    ...(displayName || '').split(',').map(normalize),
    ...(hintName || '').split(/[,&/()-]/).map(normalize),
  ].filter(v => v && !GENERIC.test(v))
  for (const t of tokens) {
    const c = canonicalize(t)
    if (KNOWN.some(k => k.toLowerCase() === c.toLowerCase())) return c
  }
  return pri[0] || 'Unknown'
}

async function geocodeQuery(q, opts = {}) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=sg&q=${encodeURIComponent(q)}`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'greenbuildings-sg-csv-converter/1.0',
      'Accept-Language': 'en',
    },
  })
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`)
  const data = await res.json()
  if (Array.isArray(data) && data.length > 0) {
    const { lat, lon, display_name, address } = data[0]
    const district = pickDistrict(address, display_name, opts.hintName, opts.postal)
    return { lat: Number(lat), lon: Number(lon), district }
  }
  return null
}

function makeCacheKey(postal, name) {
  const p = (postal || '').trim()
  const n = (name || '').trim()
  if (p) return `POSTAL:${p}`
  if (n) return `NAME:${n.toUpperCase()}`
  return 'MISSING'
}

async function geocodePostalOrName(postal, name) {
  const p = (postal || '').trim()
  const n = (name || '').trim()
  if (/^\d{6}$/.test(p)) {
    return await geocodeQuery(`${p}, Singapore`, { hintName: n, postal: p })
  }
  if (n) {
    return await geocodeQuery(`${n}, Singapore`, { hintName: n, postal: p })
  }
  return null
}

async function main() {
  const [csvPath, outPath, limitArg, skipArg, offsetArg] = process.argv.slice(2)
  if (!csvPath || !outPath) {
    console.error('Usage: node scripts/convert-csv.mjs <csvPath> <outPath> [limit|all] [skipGeocode]')
    process.exit(1)
  }
  const skipGeocode = !!skipArg && /skip|true|1/i.test(skipArg)
  const raw = await readFile(csvPath, 'utf8')
  const records = parse(raw, {
    columns: true,
    skip_empty_lines: true,
  })
  // Load cache if present
  let cache = {}
  try {
    cache = JSON.parse(await readFile(new URL('./geocode-cache.json', import.meta.url)))
  } catch {}

  const offset = Number(offsetArg || 0)
  const sliced = (limitArg && /all/i.test(limitArg)) ? records.slice(offset) : records.slice(offset, offset + Number(limitArg || 300))
  const out = []

  const startAll = Date.now()
  for (let i = 0; i < sliced.length; i++) {
    const iterStart = Date.now()
    const r = sliced[i]
    const id = offset + i + 1
    const name = r.Project_Name?.trim() || `Building ${id}`
    const postal = (r.Postal_Code || '').toString().trim()
    if (SHOULD_LOG && i % 10 === 0) {
      console.log(`[progress] ${i+1}/${sliced.length} starting: ${name} (${postal || 'no postal'})`)
    }
    const rating = r.Rating?.trim() || 'Certified'
    const projectType = r.Project_Type?.trim() || 'Mixed Use'
    const expiry = r.Expiry?.trim() || ''
    const gfaNum = Number(String(r.GFA || '').replace(/,/g, ''))
    const totalFloorArea = synthFloorAreaByType(projectType, Number.isFinite(gfaNum) ? gfaNum : 0)
    const energyIntensity = synthEnergyIntensity(rating)
    const carbonSavings = synthCarbonSavings(rating)
    const occupancyRate = Math.round(80 + Math.random() * 15)
    const yearBuilt = 1995 + Math.floor(Math.random() * 30)

    let coords = [103.851959, 1.29027] // default CBD
    let district = 'Unknown'
    if (!skipGeocode) {
      try {
        const key = makeCacheKey(postal, name)
        const cached = cache[key]
        if (cached && cached.miss) {
          // negative cache: skip
        } else if (cached) {
          if (Number.isFinite(cached.lon) && Number.isFinite(cached.lat)) {
            coords = [cached.lon, cached.lat]
          }
          if (cached.district) {
            district = cached.district
          }
        } else {
          const t0 = Date.now()
          await sleep(Number(process.env.GEOCODE_DELAY_MS || 1200)) // throttle for Nominatim
          const geo = await geocodePostalOrName(postal, name)
          const dt = Date.now() - t0
          if (SHOULD_LOG) console.log(`[geocode] ${name} (${postal || 'no postal'}) -> ${geo ? geo.district : 'miss'} in ${dt}ms`)
          if (geo) {
            cache[key] = geo
            coords = [geo.lon, geo.lat]
            district = geo.district
          } else {
            cache[key] = { miss: true, district: 'Unknown' }
          }
        }
      } catch (e) {
        // keep defaults
      }
    }

    const electricityMonthly = Math.round((energyIntensity * totalFloorArea / 12) * 0.25)
    const rentalMonthly = Math.round(totalFloorArea * 10)
    const estimatedMonthlyCost = electricityMonthly + rentalMonthly

    out.push({
      id,
      name,
      address: `Singapore ${postal}`,
      district,
      greenMarkRating: rating,
      buildingType: projectType,
      energyIntensity,
      totalFloorArea,
      yearBuilt,
      certificationValidUntil: expiry,
      estimatedMonthlyCost,
      carbonSavings,
      occupancyRate,
      amenities: amenitiesForType(projectType),
      coordinates: coords,
    })
  }

  if (SHOULD_LOG) {
    console.log(`[progress] done in ${Date.now() - startAll}ms`)
  }
  // Persist cache
  try {
    await writeFile(new URL('./geocode-cache.json', import.meta.url), JSON.stringify(cache, null, 2))
  } catch {}
  await writeFile(outPath, JSON.stringify(out, null, 2))
  console.log(`Wrote ${out.length} records to ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
