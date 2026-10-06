# Hotel Travel Planner Requirements

## Technology Constraint

- The application must be implemented using only HTML, CSS, and JavaScript. It must not require a server-side application, database, or additional programming language.

## Initial Search Screen

- The first screen must provide a start date and an end date.
- The first screen must provide separate inputs for the number of adults and the number of children.
- When the number of children is greater than zero, the screen must provide one age input for each child. Changing the child count must update the age inputs accordingly.
- The first screen must provide an input for the medical clinic address. The address will be used to calculate distances to selected hotels.
- Validate that the dates form a valid stay, that the guest counts are valid non-negative whole numbers, and that an age is provided for each child before searching.

## Hotel List

- After the user submits valid search details, the application must read the Hotels section of the [Food Allergy Institute Travel Guide](https://foodallergyinstitute.com/travel-guide) and display its hotels grouped under their corresponding cities (for example, Long Beach Hotels and Los Angeles Hotels).
- Each city and each hotel must have a checkbox. Selecting or clearing a city must select or clear the hotels in that city; users must also be able to select or clear individual hotels.
- Each hotel entry must show its name, a link to its hotel URL, and any discount code or booking information found on the Travel Guide page or the linked hotel URL.
- Do not request a hotel's price or calculate its distance until that hotel is selected. When a selection is cleared, do not start further lookups for it.

## Price and Distance Lookups

- For each selected hotel, look up and display the price for the requested dates, adult count, child count, and each child's age. Use the hotel's linked URL and any applicable discount code found by following the Travel Guide's hotel link.
- Display the currency, stay dates, and guest configuration associated with each returned price. Do not present an unavailable, incomplete, or unverified price as a confirmed price.
- For each selected hotel, calculate and display the distance from the provided medical clinic address to the hotel address. Resolve the hotel address and clinic address to usable locations before calculating distance; if either cannot be resolved, show a clear unavailable status rather than an estimated distance presented as exact.
- If a price or distance cannot be obtained, show the affected hotel and a concise reason, and allow the user to retry without restarting the search.

## Lookup Progress and Diagnostics

- While a selected hotel's price or distance is being retrieved, show a processing dialog or panel that identifies the hotel, the operation in progress, and the URL being accessed when applicable.
- Show useful progress and diagnostic information, including HTTP/status information and a readable summary of responses or errors. Do not expose credentials, private tokens, or other secrets.
- Keep the user informed as lookups start, succeed, fail, or are cancelled. A failure for one hotel must not prevent lookups for other selected hotels.
- Because the application is restricted to browser-side HTML, CSS, and JavaScript, external hotel sites or mapping services may block requests through browser security rules or may not expose prices in a machine-readable form. Detect these cases, report them in the diagnostics, and show the price or distance as unavailable; do not imply that the application can bypass such restrictions.
