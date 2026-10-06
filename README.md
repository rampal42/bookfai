# FAI Stayfinder

A browser-only hotel comparison tool for planning a Food Allergy Institute visit. Open `index.html` in a browser, enter the stay and guest details plus the clinic address, then search the Travel Guide.

## Browser limitations

The Travel Guide and hotel booking sites may block cross-origin requests. If the live guide cannot be read, save the Travel Guide page as an HTML file and load it with **Choose HTML file**. Hotel prices are only shown as automatically confirmed when a booking page returns structured data matching the requested dates and guest counts. Otherwise, open the dated booking link to verify the total and record it in the hotel row. Price entries recorded this way are labeled as user-verified.

Driving distances use the public Photon geocoder and OSRM routing service. Their availability and address matching depend on those external services.
