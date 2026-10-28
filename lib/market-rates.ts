// Generated from 117 Seattle airport cars on Turo, March to October 2026, by
// .local-supabase/pricing/gen-market.mjs. Each price is the car's average day, before
// the weekday, season and holiday moves in lib/auto-pricing.ts. Turo lists cars older
// than 2014 as 2014.

/** Typical average-day price in cents, by "make|model" (lowercase) and model year. */
export const MARKET_RATES: Record<string, Record<number, number>> = {
  "acura|mdx": {
    2014: 5300
  },
  "chevrolet|cruze": {
    2016: 3900
  },
  "chevrolet|malibu": {
    2014: 4100,
    2018: 4600
  },
  "chevrolet|silverado": {
    2017: 5200
  },
  "chevrolet|sonic": {
    2014: 3900,
    2015: 4000
  },
  "dodge|grand caravan": {
    2014: 5100,
    2017: 6400
  },
  "dodge|journey": {
    2016: 4500
  },
  "fiat|500": {
    2014: 3800
  },
  "fiat|500l": {
    2014: 4100
  },
  "fiat|500x": {
    2016: 4500
  },
  "ford|escape": {
    2014: 4600,
    2018: 5600
  },
  "ford|f-150": {
    2014: 3700,
    2015: 4800,
    2016: 5200
  },
  "ford|fiesta": {
    2014: 3800,
    2015: 4100
  },
  "ford|focus": {
    2014: 3800,
    2016: 4200,
    2018: 4400
  },
  "ford|fusion": {
    2014: 4400,
    2015: 4200,
    2017: 4600
  },
  "honda|accord": {
    2014: 4900
  },
  "honda|civic": {
    2014: 4300
  },
  "honda|odyssey": {
    2014: 5500
  },
  "hyundai|accent": {
    2014: 3800
  },
  "hyundai|elantra": {
    2014: 3900,
    2022: 4800
  },
  "hyundai|kona": {
    2022: 4800
  },
  "hyundai|santa fe hybrid": {
    2023: 5600
  },
  "hyundai|santa fe": {
    2022: 5100,
    2023: 5300
  },
  "hyundai|sonata": {
    2014: 4300
  },
  "hyundai|tucson": {
    2022: 5100
  },
  "jeep|patriot": {
    2014: 4600,
    2016: 4500
  },
  "kia|forte": {
    2015: 4000,
    2016: 4200
  },
  "kia|niro": {
    2017: 4600,
    2023: 5000,
    2025: 5200
  },
  "kia|rio": {
    2014: 3700,
    2016: 4000
  },
  "kia|sedona": {
    2014: 4800
  },
  "kia|sorento": {
    2018: 4900
  },
  "kia|soul": {
    2014: 4300,
    2016: 4300,
    2021: 5200,
    2022: 4600,
    2023: 4700,
    2024: 4800
  },
  "kia|sportage": {
    2017: 4700
  },
  "lexus|ct": {
    2014: 4300
  },
  "maserati|ghibli": {
    2017: 5600
  },
  "mazda|mazda5": {
    2014: 4400
  },
  "mitsubishi|mirage": {
    2015: 4000
  },
  "mitsubishi|outlander": {
    2016: 4600
  },
  "nissan|altima": {
    2015: 4200
  },
  "nissan|rogue": {
    2015: 4400
  },
  "scion|iq": {
    2014: 3500
  },
  "smart|fortwo": {
    2014: 3800,
    2015: 3600
  },
  "toyota|4runner": {
    2016: 6300
  },
  "toyota|camry": {
    2017: 4500
  },
  "toyota|corolla cross": {
    2026: 5500
  },
  "toyota|corolla": {
    2014: 4200,
    2022: 4800
  },
  "toyota|highlander": {
    2021: 5900
  },
  "toyota|prius c": {
    2014: 4600
  },
  "toyota|prius": {
    2014: 4400
  },
  "toyota|rav4": {
    2014: 5000,
    2023: 5300,
    2024: 5200,
    2025: 5900
  },
  "volkswagen|jetta": {
    2014: 4100
  }
};

/** Prices move this much (as a log) for each year older a car is. */
export const AGE_SLOPE = -0.0223;

/** Typical price for a 10-year-old car of each type, when the model isn't known. */
export const TYPE_RATES: Record<string, number> = {
  "suv": 4500,
  "sedan": 4400,
  "truck": 5100,
  "van": 5800,
  "sports": 4100
};
