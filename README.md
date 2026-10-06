# FAI Stayfinder

A browser-only hotel comparison tool for planning a Food Allergy Institute visit. Open `index.html` in a browser; the hotel list and precomputed driving distances load from `hotels.json` on startup. The default search is November 11–12, 2026, for two adults and two children (ages 15 and 17), using the Signal Hill clinic address.

Each hotel's distance is precomputed from the clinic address in `hotels.json`. If the clinic address is changed, the stored distance is marked unavailable rather than reused; the Google Maps directions link uses the hotel as its start and the current clinic address as its destination.

## Browser limitations

When opened directly as a `file://` URL, browser security may prevent loading `hotels.json`. If so, load it with **Choose JSON file**, or serve the folder as static files. Hotel booking sites may block cross-origin requests or fail to expose rates. Prices are only shown as automatically confirmed when a booking page returns structured data matching the requested dates and guest counts. Otherwise, open the dated booking link to verify the total and record it in the hotel row. Price entries recorded this way are labeled as user-verified.

The JSON distances are driving routes computed outside the browser and stored with the hotel data, so selecting a hotel does not trigger distance or geocoding requests.
