# Hotel Travel Planner Requirements

## Technology Constraint

- The application must be implemented using only HTML, CSS, and JavaScript. It must not require a server-side application, database, or additional programming language.

## Initial Search Screen

- The first screen must provide a start date and an end date.
- The first screen must provide separate inputs for the number of adults and the number of children.
- When the number of children is greater than zero, the screen must provide one age input for each child. Changing the child count must update the age inputs accordingly.
- The first screen must provide an input for the medical clinic address. The address will be used to calculate distances to selected hotels.
- Defaults must be November 11, 2026 through November 12, 2026, two adults, two children aged 15 and 17, and `2704 E Willow St, Signal Hill, CA 90755` as the clinic address.
- On app startup, load and display the hotel list and stored distances without requiring the user to submit the search form first.
- Validate that the dates form a valid stay, that the guest counts are valid non-negative whole numbers, and that an age is provided for each child before searching.

## Hotel List

- The application must use the bundled `hotels.json` file as its runtime hotel directory and must load it on startup. It must not visit or fetch the live Travel Guide page at runtime to obtain the hotel list.
- The JSON file must contain each hotel's name, discount or booking code, address, booking URL, and precomputed driving distance from the clinic address recorded in that JSON file.
- Display hotels grouped by their city heading. The app must display precomputed distances immediately, regardless of hotel checkbox state, and must not make runtime distance or geocoding requests for those entries.
- Each city and each hotel must have a checkbox. Selecting or clearing a city must select or clear the hotels in that city; users must also be able to select or clear individual hotels.
- Each hotel entry must show its name, address when available, original hotel booking URL, and any corporate, promo, or discount code found in the bundled file or in the URL query parameters. Keep existing booking URL parameters, including discount codes, when adding the requested dates and guest information.
- Each hotel entry must include a Google Maps directions action. Use the hotel's address as the origin and the current clinic address as the destination.
- Do not request a hotel's price until that hotel is selected. Distances are static JSON data, not per-hotel runtime lookups. When a selection is cleared, cancel its active price request.

## Price and Distance Lookups

- For each selected hotel, look up and display the price for the requested dates, adult count, child count, and each child's age. Use the hotel's original booking URL and any applicable discount code from the bundled file or URL.
- Display the currency, stay dates, and guest configuration associated with each returned price. Do not present an unavailable, incomplete, or unverified price as a confirmed price.
- Display the static driving distance stored in `hotels.json` from each hotel to the JSON's clinic address. If the user changes the clinic address, do not show a stored distance as if it applied to the new address; show it as unavailable and use the current clinic value in the Google Maps directions action.
- If a price cannot be obtained, show the affected hotel and a concise reason, and allow the user to retry without restarting the search.

## Lookup Progress and Diagnostics

- While a selected hotel's price is being retrieved, show a processing dialog or panel that identifies the hotel, the operation in progress, and the URL being accessed when applicable. Static distances must not trigger a lookup.
- Show useful progress and diagnostic information, including HTTP/status information and a readable summary of responses or errors. Do not expose credentials, private tokens, or other secrets.
- Keep the user informed as lookups start, succeed, fail, or are cancelled. A failure for one hotel must not prevent lookups for other selected hotels.
- Because the application is restricted to browser-side HTML, CSS, and JavaScript, external hotel sites may block requests through browser security rules or may not expose prices in a machine-readable form. Detect these cases, report them in the diagnostics, and show the price as unavailable; do not imply that the application can bypass such restrictions. If browser `file://` restrictions prevent reading the bundled JSON, let the user select `hotels.json` locally; do not fall back to fetching the live Travel Guide.
