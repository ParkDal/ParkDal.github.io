(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.addEventListener('click', (event) => {
      if (event.target.matches('a')) {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const weatherPlace = document.querySelector('#weather-place');
  const weatherValue = document.querySelector('#weather-value');
  const weatherMeta = document.querySelector('#weather-meta');
  const exchangeContent = document.querySelector('#exchange-content');
  const weatherRefresh = document.querySelector('#weather-refresh');
  const exchangeRefresh = document.querySelector('#exchange-refresh');
  const fallbackLocation = { latitude: 37.5665, longitude: 126.978, label: '서울, 대한민국' };
  const weatherText = { 0: '맑음', 1: '대체로 맑음', 2: '부분적으로 흐림', 3: '흐림', 45: '안개', 48: '짙은 안개', 51: '이슬비', 61: '비', 71: '눈', 80: '소나기', 95: '뇌우' };
  const currencies = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD'];

  async function loadWeather(location = fallbackLocation) {
    if (!weatherPlace || !weatherValue || !weatherMeta) return;
    weatherPlace.textContent = location.label;
    weatherMeta.textContent = '날씨를 불러오는 중입니다.';
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`weather-${response.status}`);
      const data = await response.json();
      const current = data.current;
      const timezone = data.timezone || '현지 시간대';
      weatherPlace.textContent = location.label;
      weatherValue.textContent = `${Math.round(current.temperature_2m)}°C`;
      weatherMeta.textContent = `${weatherText[current.weather_code] || '현재 날씨'} · 바람 ${Math.round(current.wind_speed_10m)} km/h · ${timezone}`;
    } catch (error) {
      if (location !== fallbackLocation) return loadWeather(fallbackLocation);
      weatherValue.textContent = '--°C';
      weatherMeta.textContent = '날씨를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
    }
  }

  function requestWeather() {
    if (!navigator.geolocation) return loadWeather();
    navigator.geolocation.getCurrentPosition(
      (position) => loadWeather({ latitude: position.coords.latitude, longitude: position.coords.longitude, label: '현재 위치' }),
      () => loadWeather(),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 900000 }
    );
  }

  function renderExchange(rates, date) {
    if (!exchangeContent) return;
    exchangeContent.innerHTML = currencies.map((currency) => {
      const value = rates[currency];
      return `<div class="exchange-row"><span>${currency}</span><span>${typeof value === 'number' ? value.toFixed(currency === 'JPY' ? 2 : 4) : '—'}</span></div>`;
    }).join('');
    const note = document.createElement('p');
    note.className = 'exchange-date';
    note.textContent = `기준일 ${date} · 1 KRW 기준`;
    exchangeContent.append(note);
  }

  async function loadExchange(force = false) {
    if (!exchangeContent) return;
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = 'parkdal-exchange-v1';
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && cached.day === today) return renderExchange(cached.rates, cached.date);
      } catch (error) { /* ignore malformed local cache */ }
    }
    exchangeContent.innerHTML = '<p>환율을 불러오는 중입니다.</p>';
    try {
      const query = currencies.join(',');
      const response = await fetch(`https://api.frankfurter.dev/v2/rates?base=KRW&quotes=${query}`);
      if (!response.ok) throw new Error(`exchange-${response.status}`);
      const payload = await response.json();
      const rows = Array.isArray(payload) ? payload : Object.entries(payload.rates || {}).map(([quote, rate]) => ({ quote, rate }));
      const rates = Object.fromEntries(rows.map((row) => [row.quote || row.currency, Number(row.rate)]));
      const date = payload.date || rows[0]?.date || today;
      localStorage.setItem(cacheKey, JSON.stringify({ day: today, date, rates }));
      renderExchange(rates, date);
    } catch (error) {
      exchangeContent.innerHTML = '<p>환율을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>';
    }
  }

  weatherRefresh?.addEventListener('click', requestWeather);
  exchangeRefresh?.addEventListener('click', () => loadExchange(true));
  requestWeather();
  loadExchange();
})();
