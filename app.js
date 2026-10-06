const GUIDE_URL = 'https://foodallergyinstitute.com/travel-guide';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving/';
const elements = {
  form: document.querySelector('#search-form'),
  start: document.querySelector('#start-date'),
  end: document.querySelector('#end-date'),
  adults: document.querySelector('#adult-count'),
  children: document.querySelector('#child-count'),
  childAges: document.querySelector('#child-ages'),
  ageInputs: document.querySelector('#age-inputs'),
  clinic: document.querySelector('#clinic-address'),
  formError: document.querySelector('#form-error'),
  guideStatus: document.querySelector('#guide-status'),
  guideStatusText: document.querySelector('#guide-status-text'),
  sourceFallback: document.querySelector('#source-fallback'),
  guideFile: document.querySelector('#guide-file'),
  results: document.querySelector('#hotel-results'),
  resultsSummary: document.querySelector('#results-summary'),
  cityList: document.querySelector('#city-list'),
  refresh: document.querySelector('#refresh-guide'),
  log: document.querySelector('#diagnostic-log'),
  logCount: document.querySelector('#log-count'),
  dialog: document.querySelector('#activity-dialog'),
  activityLog: document.querySelector('#activity-log'),
  closeDialog: document.querySelector('#close-dialog'),
  hotelTemplate: document.querySelector('#hotel-template')
};

let hotels = [];
let criteria = null;
let logs = [];
const controllers = new Map();
const geocodeCache = new Map();

function cleanText(value) {
  return value.replace(/\u00a0/g, ' ').replace(/[\t\r ]+/g, ' ').replace(/\n\s+/g, '\n').trim();
}

function setGuideStatus(message, state = 'idle') {
  elements.guideStatusText.textContent = message;
  elements.guideStatus.dataset.state = state;
}

function addLog(message) {
  const entry = { time: new Date().toLocaleTimeString(), message };
  logs.push(entry);
  if (logs.length > 150) logs = logs.slice(-150);
  renderLogs();
  if (elements.dialog.open) appendActivity(entry);
}

function appendActivity(entry) {
  const item = document.createElement('li');
  const time = document.createElement('span');
  const text = document.createElement('span');
  time.className = 'log-time';
  time.textContent = entry.time;
  text.textContent = entry.message;
  item.append(time, text);
  elements.activityLog.append(item);
  elements.activityLog.scrollTop = elements.activityLog.scrollHeight;
}

function renderLogs() {
  elements.log.replaceChildren();
  for (const entry of logs) {
    const item = document.createElement('li');
    const time = document.createElement('span');
    const text = document.createElement('span');
    time.className = 'log-time';
    time.textContent = entry.time;
    text.textContent = entry.message;
    item.append(time, text);
    elements.log.append(item);
  }
  elements.logCount.textContent = `${logs.length} ${logs.length === 1 ? 'event' : 'events'}`;
}

function openActivity() {
  if (!elements.dialog.open) elements.dialog.showModal();
}

function updateAgeInputs() {
  const count = Number(elements.children.value);
  elements.ageInputs.replaceChildren();
  elements.childAges.hidden = !Number.isInteger(count) || count < 1;
  if (!Number.isInteger(count) || count < 1 || count > 12) return;

  for (let index = 0; index < count; index += 1) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    const input = document.createElement('input');
    label.className = 'field';
    caption.className = 'field-label';
    caption.textContent = `Child ${index + 1}`;
    input.className = 'field input age-input';
    input.type = 'number';
    input.min = '0';
    input.max = '17';
    input.step = '1';
    input.required = true;
    input.dataset.childAge = String(index);
    input.setAttribute('aria-label', `Age of child ${index + 1}`);
    label.append(caption, input);
    elements.ageInputs.append(label);
  }
}

elements.children.addEventListener('input', updateAgeInputs);
elements.start.addEventListener('change', () => {
  if (!elements.start.value) return;
  const nextDay = new Date(`${elements.start.value}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);
  elements.end.min = nextDay.toISOString().slice(0, 10);
});

function validateSearch() {
  const adultCount = Number(elements.adults.value);
  const childCount = Number(elements.children.value);
  const ages = [...elements.ageInputs.querySelectorAll('[data-child-age]')].map((input) => Number(input.value));
  const startDate = elements.start.value;
  const endDate = elements.end.value;
  const clinicAddress = elements.clinic.value.trim();

  if (!startDate || !endDate || new Date(`${startDate}T00:00:00`) >= new Date(`${endDate}T00:00:00`)) {
    return { error: 'Choose a valid check-in and check-out date. Check-out must be after check-in.' };
  }
  if (!Number.isInteger(adultCount) || adultCount < 0 || !Number.isInteger(childCount) || childCount < 0 || childCount > 12 || adultCount + childCount < 1) {
    return { error: 'Enter whole-number guest counts, with at least one guest and no more than 12 children.' };
  }
  if (ages.length !== childCount || ages.some((age) => !Number.isInteger(age) || age < 0 || age > 17)) {
    return { error: 'Enter an age from 0 to 17 for each child.' };
  }
  if (!clinicAddress) return { error: 'Enter the medical clinic address.' };
  return { value: { startDate, endDate, adults: adultCount, children: childCount, childAges: ages, clinicAddress } };
}

function textBetween(anchor, nextAnchor, container) {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setStartAfter(anchor);
  if (nextAnchor) range.setEndBefore(nextAnchor);
  const fragment = range.cloneContents();
  const wrapper = document.createElement('div');
  wrapper.append(fragment);
  for (const br of wrapper.querySelectorAll('br')) br.replaceWith('\n');
  return cleanText(wrapper.textContent || '');
}

function getCodeFromUrl(href) {
  try {
    const url = new URL(href);
    for (const key of ['promo', 'promocode', 'corporatecode', 'corpcode', 'discountcode', 'promotion']) {
      const value = url.searchParams.get(key);
      if (value) return value;
    }
  } catch {
    return '';
  }
  return '';
}

function parseHotelSection(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const sections = [...parsed.querySelectorAll('.accordion-item')];
  const found = [];

  for (const section of sections) {
    const title = cleanText(section.querySelector('.accordion-title')?.textContent || '');
    if (!/\bHotels\b/i.test(title)) continue;
    const content = section.querySelector('.accordion-content');
    if (!content) continue;
    const anchors = [...content.querySelectorAll('a[href]')].filter((anchor) => {
      const name = cleanText(anchor.textContent || '');
      if (!name || name.length < 3 || /^(book here|click here|website|directions|call)$/i.test(name)) return false;
      if (/^tel:|^mailto:/i.test(anchor.getAttribute('href') || '')) return false;
      try {
        const url = new URL(anchor.href);
        return /^https?:$/.test(url.protocol) && !(/google\.[^/]+$/.test(url.hostname) && /search/i.test(url.pathname));
      } catch {
        return false;
      }
    });
    const citySeen = new Set();

    anchors.forEach((anchor, index) => {
      const name = cleanText(anchor.textContent || '');
      const href = anchor.href;
      const metadata = textBetween(anchor, anchors[index + 1] || null, content);
      const addressMatch = metadata.match(/\bAddress\s*:\s*([\s\S]*?)(?=\n\s*(?:Phone|Corporate\s+Code|Discount\s+Code|Promo(?:tion)?\s+Code)\s*:|$)/i);
      const codeMatch = metadata.match(/\b(?:Corporate\s+Code|Discount\s+Code|Promo(?:tion)?\s+Code)\s*:\s*([^\n]+)/i);
      const city = title.replace(/\s*Hotels\b.*$/i, '').trim() || title;
      const key = `${city.toLowerCase()}|${name.toLowerCase()}`;
      if (citySeen.has(key)) return;
      citySeen.add(key);
      found.push({
        id: `${slug(`${city}-${name}`)}-${found.length}`,
        name,
        city,
        cityHeading: title,
        url: href,
        address: addressMatch ? cleanText(addressMatch[1]).replace(/\s*\n\s*/g, ', ') : '',
        code: codeMatch ? cleanText(codeMatch[1]) : getCodeFromUrl(href),
        selected: false,
        priceState: 'idle',
        priceMessage: '',
        priceAmount: null,
        priceDraft: '',
        distanceState: 'idle',
        distanceMessage: ''
      });
    });
  }
  return found;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hotel';
}

function populateHotels(html, sourceLabel) {
  hotels = parseHotelSection(html);
  for (const hotel of hotels) {
    hotel.selected = false;
    hotel.priceState = 'idle';
    hotel.priceMessage = '';
    hotel.priceAmount = null;
    hotel.priceDraft = '';
    hotel.distanceState = 'idle';
    hotel.distanceMessage = '';
  }
  elements.results.hidden = false;
  elements.sourceFallback.hidden = true;
  elements.resultsSummary.textContent = `${hotels.length} hotels parsed from ${sourceLabel} · ${criteria.adults} adults · ${criteria.children} children · ${criteria.startDate} to ${criteria.endDate}`;
  setGuideStatus(hotels.length ? `Loaded ${hotels.length} hotels from ${sourceLabel}.` : `No hotel listings were found in ${sourceLabel}.`, hotels.length ? 'success' : 'error');
  addLog(`Parsed ${hotels.length} hotel entries from ${sourceLabel}.`);
  renderHotels();
}

async function loadGuide() {
  elements.formError.hidden = true;
  elements.sourceFallback.hidden = true;
  setGuideStatus('Fetching the Travel Guide page…', 'loading');
  addLog(`GET ${GUIDE_URL}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(GUIDE_URL, { mode: 'cors', signal: controller.signal });
    addLog(`Travel Guide response: HTTP ${response.status} ${response.statusText || ''}`.trim());
    if (!response.ok) throw new Error(`The Travel Guide returned HTTP ${response.status}.`);
    const html = await response.text();
    addLog(`Travel Guide response body: ${html.length} characters, ${response.headers.get('content-type') || 'unknown content type'}.`);
    populateHotels(html, 'the live Travel Guide');
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'The Travel Guide request timed out or was cancelled.'
      : `The Travel Guide could not be read in this browser (${error.message || 'cross-origin access blocked'}).`;
    setGuideStatus(`${message} Load a saved HTML copy to continue.`, 'error');
    elements.sourceFallback.hidden = false;
    addLog(`Travel Guide load failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const validation = validateSearch();
  if (validation.error) {
    elements.formError.textContent = validation.error;
    elements.formError.hidden = false;
    return;
  }
  elements.formError.hidden = true;
  criteria = validation.value;
  await loadGuide();
});

elements.guideFile.addEventListener('change', async () => {
  const file = elements.guideFile.files?.[0];
  if (!file) return;
  setGuideStatus(`Reading ${file.name}…`, 'loading');
  try {
    const html = await file.text();
    populateHotels(html, file.name);
  } catch (error) {
    setGuideStatus(`Could not read the selected file: ${error.message}`, 'error');
    addLog(`Local guide read failed: ${error.message}`);
  } finally {
    elements.guideFile.value = '';
  }
});

elements.refresh.addEventListener('click', loadGuide);
elements.closeDialog.addEventListener('click', () => elements.dialog.close());

function bookingUrl(hotel) {
  const url = new URL(hotel.url);
  const host = url.hostname.toLowerCase();
  const { startDate, endDate, adults, children, childAges } = criteria;
  const set = (key, value) => url.searchParams.set(key, String(value));

  if (url.searchParams.has('arrive') || host.includes('synxis')) {
    set('arrive', startDate); set('depart', endDate); set('adult', adults); set('child', children); set('rooms', 1);
  } else if (host.includes('hilton.com')) {
    set('checkin', startDate); set('checkout', endDate); set('numAdults', adults); set('numChildren', children);
  } else if (host.includes('marriott.com')) {
    set('checkinDate', startDate); set('checkoutDate', endDate); set('numberOfAdults', adults); set('numberOfChildren', children);
  } else if (host.includes('hyatt.com')) {
    set('checkinDate', startDate); set('checkoutDate', endDate); set('adults', adults); set('children', children);
  } else if (host.includes('ihg.com')) {
    set('checkInDate', startDate); set('checkOutDate', endDate); set('adults', adults); set('children', children);
  } else {
    set('checkin', startDate); set('checkout', endDate); set('adults', adults); set('children', children);
  }
  if (children > 0) set('childAges', childAges.join(','));
  return url.toString();
}

function normalizeDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function findConfirmedStayTotal(html) {
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const scripts = [...parsed.querySelectorAll('script[type="application/ld+json"]')];
  const { startDate, endDate, adults, children } = criteria;
  const dateKeys = { start: /^(checkin|checkindate|arrivaldate|arrive|startdate)$/i, end: /^(checkout|checkoutdate|departuredate|depart|enddate)$/i };
  const amountKeys = /^(staytotal|totalprice|bookingtotal|grandtotal)$/i;
  const results = [];

  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const entries = Object.entries(value);
    const start = entries.find(([key]) => dateKeys.start.test(key))?.[1];
    const end = entries.find(([key]) => dateKeys.end.test(key))?.[1];
    const adultCount = entries.find(([key]) => /^(adults|numberofadults|adultcount)$/i.test(key))?.[1];
    const childCount = entries.find(([key]) => /^(children|numberofchildren|childcount)$/i.test(key))?.[1];
    const amountEntry = entries.find(([key]) => amountKeys.test(key));
    if (amountEntry && normalizeDate(start) === startDate && normalizeDate(end) === endDate && Number(adultCount) === adults && Number(childCount) === children) {
      const raw = amountEntry[1];
      const amount = Number(typeof raw === 'object' ? raw.value ?? raw.amount : raw);
      const currency = typeof raw === 'object' ? raw.currency || value.priceCurrency || 'USD' : value.priceCurrency || 'USD';
      if (Number.isFinite(amount) && amount >= 0) results.push({ amount, currency });
    }
    entries.forEach(([, child]) => walk(child));
  }

  for (const script of scripts) {
    try { walk(JSON.parse(script.textContent)); } catch { /* Ignore malformed structured data. */ }
  }
  return results[0] || null;
}

async function fetchWithTimeout(url, signal, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  if (signal.aborted) controller.abort();
  else signal.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    return await fetch(url, { ...options, mode: 'cors', signal: controller.signal });
  } catch (error) {
    if (!signal.aborted && controller.signal.aborted) throw new Error('Request timed out after 14 seconds.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupPrice(hotel, signal) {
  const url = bookingUrl(hotel);
  hotel.priceState = 'loading';
  hotel.priceMessage = 'Requesting the dated booking page…';
  renderHotels();
  addLog(`${hotel.name}: requesting booking page ${url}`);
  try {
    const response = await fetchWithTimeout(url, signal);
    addLog(`${hotel.name}: booking page returned HTTP ${response.status} ${response.statusText || ''}`.trim());
    if (!response.ok) throw new Error(`Booking page returned HTTP ${response.status}.`);
    const html = await response.text();
    addLog(`${hotel.name}: booking response body ${html.length} characters, ${response.headers.get('content-type') || 'unknown content type'}.`);
    if (controllers.get(`${hotel.id}:price`)?.signal !== signal || signal.aborted) return;
    const confirmed = findConfirmedStayTotal(html);
    if (confirmed) {
      hotel.priceState = 'success';
      hotel.priceAmount = confirmed.amount;
      hotel.priceCurrency = confirmed.currency;
      hotel.priceMessage = `Structured total matches ${criteria.startDate}–${criteria.endDate} and the requested guest counts.`;
      addLog(`${hotel.name}: found a structured stay total (${confirmed.currency} ${confirmed.amount}).`);
    } else {
      hotel.priceState = 'unavailable';
      hotel.priceMessage = 'No date- and guest-matched stay total was exposed. Open the booking page to verify a rate.';
      addLog(`${hotel.name}: page was readable, but it did not expose a verifiable total for this stay.`);
    }
  } catch (error) {
    if (controllers.get(`${hotel.id}:price`)?.signal !== signal) return;
    if (signal.aborted) {
      hotel.priceState = 'idle';
      hotel.priceMessage = 'Lookup cancelled because the hotel was deselected.';
      addLog(`${hotel.name}: price lookup cancelled.`);
    } else {
      hotel.priceState = 'unavailable';
      hotel.priceMessage = error.message.includes('HTTP') ? error.message : 'The hotel site blocked browser access or did not respond. Use the dated booking link to verify.';
      addLog(`${hotel.name}: price lookup failed for ${url}: ${error.message || 'browser cross-origin access blocked'}`);
    }
  }
  renderHotels();
}

async function geocode(address, signal) {
  if (geocodeCache.has(address)) return geocodeCache.get(address);
  const url = `${PHOTON_URL}?q=${encodeURIComponent(address)}&limit=1&lang=en`;
  addLog(`Geocoding address: ${url}`);
  const response = await fetchWithTimeout(url, signal, { headers: { Accept: 'application/json' } });
  addLog(`Geocoder response: HTTP ${response.status} ${response.statusText || ''}`.trim());
  if (!response.ok) throw new Error(`Address lookup returned HTTP ${response.status}.`);
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature?.geometry?.coordinates) throw new Error(`No location found for: ${address}`);
  const [longitude, latitude] = feature.geometry.coordinates;
  const properties = feature.properties || {};
  const label = [properties.name, properties.street, properties.housenumber, properties.city || properties.locality, properties.state, properties.postcode]
    .filter(Boolean).join(', ') || address;
  const result = { longitude, latitude, label };
  geocodeCache.set(address, result);
  addLog(`Resolved address as: ${label}`);
  return result;
}

async function lookupDistance(hotel, signal) {
  hotel.distanceState = 'loading';
  hotel.distanceMessage = 'Resolving clinic and hotel locations…';
  renderHotels();
  if (!hotel.address) {
    hotel.distanceState = 'unavailable';
    hotel.distanceMessage = 'The Travel Guide entry does not include a hotel address.';
    addLog(`${hotel.name}: distance unavailable; no hotel address was found in the guide.`);
    renderHotels();
    return;
  }
  addLog(`${hotel.name}: calculating driving distance from ${criteria.clinicAddress} to ${hotel.address}.`);
  try {
    const [clinic, destination] = await Promise.all([
      geocode(criteria.clinicAddress, signal),
      geocode(hotel.address, signal)
    ]);
    if (controllers.get(`${hotel.id}:distance`)?.signal !== signal || signal.aborted) return;
    const routeUrl = `${OSRM_URL}${clinic.longitude},${clinic.latitude};${destination.longitude},${destination.latitude}?overview=false&alternatives=false&steps=false`;
    addLog(`${hotel.name}: requesting road route ${routeUrl}`);
    const response = await fetchWithTimeout(routeUrl, signal, { headers: { Accept: 'application/json' } });
    addLog(`${hotel.name}: route response HTTP ${response.status} ${response.statusText || ''}`.trim());
    if (!response.ok) throw new Error(`Routing service returned HTTP ${response.status}.`);
    const data = await response.json();
    if (controllers.get(`${hotel.id}:distance`)?.signal !== signal || signal.aborted) return;
    const meters = data.routes?.[0]?.distance;
    if (!Number.isFinite(meters)) throw new Error(data.message || 'No driving route was returned.');
    hotel.distanceState = 'success';
    hotel.distanceMiles = meters / 1609.344;
    hotel.distanceKm = meters / 1000;
    hotel.distanceMessage = `Driving distance · resolved clinic: ${clinic.label} · resolved hotel: ${destination.label}`;
    addLog(`${hotel.name}: driving route is ${hotel.distanceMiles.toFixed(1)} mi (${hotel.distanceKm.toFixed(1)} km).`);
  } catch (error) {
    if (controllers.get(`${hotel.id}:distance`)?.signal !== signal) return;
    if (signal.aborted) {
      hotel.distanceState = 'idle';
      hotel.distanceMessage = 'Lookup cancelled because the hotel was deselected.';
      addLog(`${hotel.name}: distance lookup cancelled.`);
    } else {
      hotel.distanceState = 'unavailable';
      hotel.distanceMessage = error.message.includes('HTTP') || error.message.startsWith('No location')
        ? error.message
        : 'The geocoding or routing service blocked the request or did not respond.';
      addLog(`${hotel.name}: distance lookup failed: ${error.message || 'browser cross-origin access blocked'}`);
    }
  }
  renderHotels();
}

function beginLookups(hotel) {
  openActivity();
  for (const type of ['price', 'distance']) {
    const key = `${hotel.id}:${type}`;
    controllers.get(key)?.abort();
    const controller = new AbortController();
    controllers.set(key, controller);
    if (type === 'price') lookupPrice(hotel, controller.signal);
    else lookupDistance(hotel, controller.signal);
  }
}

function setHotelSelection(hotel, selected) {
  hotel.selected = selected;
  if (selected) {
    beginLookups(hotel);
  } else {
    for (const type of ['price', 'distance']) controllers.get(`${hotel.id}:${type}`)?.abort();
    hotel.priceState = 'idle';
    hotel.priceMessage = '';
    hotel.distanceState = 'idle';
    hotel.distanceMessage = '';
    addLog(`${hotel.name}: deselected; active requests cancelled.`);
  }
  renderHotels();
}

function setResultCell(cell, valueNode, noteNode, state, value, note) {
  cell.dataset.state = state;
  valueNode.textContent = value;
  noteNode.textContent = note;
}

function displayPrice(hotel) {
  if (hotel.priceState === 'loading') return ['Checking…', hotel.priceMessage];
  if (hotel.priceState === 'success') return [new Intl.NumberFormat(undefined, { style: 'currency', currency: hotel.priceCurrency || 'USD' }).format(hotel.priceAmount), hotel.priceMessage];
  if (hotel.priceState === 'manual') return [new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(hotel.priceAmount), `User-verified total · ${criteria.startDate} to ${criteria.endDate} · ${criteria.adults} adults, ${criteria.children} children`];
  if (hotel.priceState === 'unavailable') return ['Unavailable', hotel.priceMessage];
  return ['Not checked', ''];
}

function displayDistance(hotel) {
  if (hotel.distanceState === 'loading') return ['Checking…', hotel.distanceMessage];
  if (hotel.distanceState === 'success') return [`${hotel.distanceMiles.toFixed(1)} mi`, `${hotel.distanceKm.toFixed(1)} km · ${hotel.distanceMessage}`];
  if (hotel.distanceState === 'unavailable') return ['Unavailable', hotel.distanceMessage];
  return ['Not checked', ''];
}

function renderHotel(hotel) {
  const fragment = elements.hotelTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.hotel-row');
  const checkbox = fragment.querySelector('.hotel-checkbox');
  const name = fragment.querySelector('.hotel-name');
  const link = fragment.querySelector('.hotel-link');
  const meta = fragment.querySelector('.hotel-meta');
  const priceCell = fragment.querySelector('.price-cell');
  const priceValue = fragment.querySelector('.price-value');
  const priceNote = fragment.querySelector('.price-note');
  const distanceCell = fragment.querySelector('.distance-cell');
  const distanceValue = fragment.querySelector('.distance-value');
  const distanceNote = fragment.querySelector('.distance-note');
  const tools = fragment.querySelector('.price-tools');
  const openRate = fragment.querySelector('.open-rate');
  const manualForm = fragment.querySelector('.manual-price-form');
  const manualInput = fragment.querySelector('.manual-price-input');
  const retry = fragment.querySelector('.retry-button');

  row.dataset.hotelId = hotel.id;
  checkbox.checked = hotel.selected;
  checkbox.setAttribute('aria-label', `Select ${hotel.name}`);
  name.textContent = hotel.name;
  link.href = hotel.url;
  const metaParts = [];
  if (hotel.address) metaParts.push(hotel.address);
  if (hotel.code) metaParts.push(`Code: ${hotel.code}`);
  meta.textContent = metaParts.join(' · ');
  meta.hidden = !metaParts.length;

  checkbox.addEventListener('change', () => setHotelSelection(hotel, checkbox.checked));
  const [priceText, priceMessage] = displayPrice(hotel);
  setResultCell(priceCell, priceValue, priceNote, hotel.priceState, priceText, priceMessage);
  const [distanceText, distanceMessage] = displayDistance(hotel);
  setResultCell(distanceCell, distanceValue, distanceNote, hotel.distanceState, distanceText, distanceMessage);

  if (hotel.selected) {
    tools.hidden = false;
    openRate.addEventListener('click', () => {
      const booking = bookingUrl(hotel);
      addLog(`${hotel.name}: opening dated booking URL ${booking}`);
      window.open(booking, '_blank', 'noopener,noreferrer');
    });
    manualInput.value = hotel.priceDraft;
    manualInput.addEventListener('input', () => { hotel.priceDraft = manualInput.value; });
    manualForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = Number(manualInput.value);
      if (!Number.isFinite(amount) || amount < 0 || !manualInput.value) {
        manualInput.focus();
        return;
      }
      hotel.priceAmount = amount;
      hotel.priceState = 'manual';
      hotel.priceMessage = 'Entered by the user after checking the hotel booking page.';
      addLog(`${hotel.name}: user recorded a verified USD total of ${amount.toFixed(2)}.`);
      renderHotels();
    });
    retry.hidden = !['unavailable'].includes(hotel.priceState) && !['unavailable'].includes(hotel.distanceState);
    retry.addEventListener('click', () => beginLookups(hotel));
  }
  return fragment;
}

function renderHotels() {
  elements.cityList.replaceChildren();
  const groups = new Map();
  for (const hotel of hotels) {
    if (!groups.has(hotel.cityHeading)) groups.set(hotel.cityHeading, []);
    groups.get(hotel.cityHeading).push(hotel);
  }
  for (const [heading, entries] of groups) {
    const section = document.createElement('section');
    const header = document.createElement('div');
    const title = document.createElement('h3');
    const label = document.createElement('label');
    const cityCheckbox = document.createElement('input');
    const labelText = document.createElement('span');
    section.className = 'city-group';
    header.className = 'city-heading';
    title.textContent = heading;
    label.className = 'city-check';
    cityCheckbox.type = 'checkbox';
    cityCheckbox.setAttribute('aria-label', `Select all hotels in ${heading}`);
    const selectedCount = entries.filter((hotel) => hotel.selected).length;
    cityCheckbox.checked = selectedCount === entries.length && entries.length > 0;
    cityCheckbox.indeterminate = selectedCount > 0 && selectedCount < entries.length;
    labelText.textContent = `${selectedCount}/${entries.length} selected`;
    label.append(cityCheckbox, labelText);
    header.append(title, label);
    section.append(header);
    for (const hotel of entries) section.append(renderHotel(hotel));
    cityCheckbox.addEventListener('change', () => {
      for (const hotel of entries) {
        if (hotel.selected !== cityCheckbox.checked) setHotelSelection(hotel, cityCheckbox.checked);
      }
    });
    elements.cityList.append(section);
  }
  if (!hotels.length) {
    const empty = document.createElement('p');
    empty.className = 'results-summary';
    empty.textContent = 'No city hotel sections were found. Check that the selected file is the Travel Guide page.';
    elements.cityList.append(empty);
  }
}
