const apartmentName = document.querySelector("#selectedApartmentName");
const searchInput = document.querySelector("#aptSearchInput");
const latestPrice = document.querySelector("#latestPrice");
const searchResults = document.querySelector("#searchResults");
const aptSelect = document.querySelector("#aptSelect");

const periodHigh = document.querySelector("#periodHigh");
const periodLow = document.querySelector("#periodLow");
const periodAverage = document.querySelector("#periodAverage");
const tradeCount = document.querySelector("#tradeCount");
const insightText = document.querySelector("#insightText");

const loadButton = document.querySelector("#loadButton");
const loadStatus = document.querySelector("#loadStatus");
const serviceKeyInput = document.querySelector("#serviceKeyInput");
const queryMonth = document.querySelector("#queryMonth");
const regionSelect = document.querySelector("#sigunguSelect");
const sidoSelect = document.querySelector("#sidoSelect");

const STORAGE_KEY = "aptick.actualTrades.v2";
const COMPARE_KEY = "aptick.compareSelection.v1";
const BUDGET_KEY = "aptick.budgetFilters.v1";

let apartments = [];
let loadedMonths = [];
let isLoading = false;

// 조회 기간 선택창
const periodContainer = document.createElement("p");
const periodLabel = document.createElement("label");
const periodSelect = document.createElement("select");

periodLabel.htmlFor = "periodSelect";
periodLabel.textContent = "조회 기간";
periodSelect.id = "periodSelect";

[
  { value: "1", label: "1개월" },
  { value: "3", label: "3개월" },
  { value: "6", label: "6개월" },
  { value: "12", label: "12개월" }
].forEach(function (item) {
  const option = document.createElement("option");
  option.value = item.value;
  option.textContent = item.label;
  periodSelect.appendChild(option);
});

periodSelect.value = "12";
periodContainer.append(periodLabel, periodSelect);
loadButton.before(periodContainer);

// 조회 결과 초기화 버튼
const resetButton = document.createElement("button");
resetButton.id = "resetButton";
resetButton.type = "button";
resetButton.textContent = "조회 결과 초기화";

Object.assign(resetButton.style, {
  gridColumn: "1 / -1",
  width: "100%",
  minHeight: "44px",
  padding: "11px 16px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  background: "#f8fafc",
  color: "#475569",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer"
});

loadButton.after(resetButton);

// 기존 검색 결과 영역은 안내 문구만 표시
searchResults.setAttribute("role", "status");
searchResults.setAttribute("aria-live", "polite");
searchResults.style.display = "block";
searchResults.style.margin = "10px 0 18px";
searchResults.style.padding = "0";
searchResults.style.listStyle = "none";

searchInput.placeholder = "아파트명 입력";
searchInput.setAttribute("aria-describedby", "searchResults");
aptSelect.setAttribute("aria-describedby", "searchResults");

function formatMonth(month) {
  return month.slice(0, 4) + "-" + month.slice(4);
}

function periodDescription(months) {
  if (!months.length) return "";

  return formatMonth(months[0]) +
    " ~ " + formatMonth(months[months.length - 1]);
}

function formatPrice(price) {
  const rounded = Math.round(price);

  if (rounded === 0) return "0원";

  const eok = Math.floor(rounded / 10000);
  const man = rounded % 10000;

  if (!eok) return man.toLocaleString("ko-KR") + "만 원";
  if (!man) return eok.toLocaleString("ko-KR") + "억 원";

  return eok.toLocaleString("ko-KR") +
    "억 " + man.toLocaleString("ko-KR") + "만 원";
}

function selectedRegionName() {
  const sido = sidoSelect?.selectedOptions[0]?.textContent || "";
  const district = regionSelect.selectedOptions[0]?.textContent || "";

  return sido === district
    ? sido
    : (sido + " " + district).trim();
}

function searchMessage(message) {
  searchResults.replaceChildren();

  const item = document.createElement("li");
  item.textContent = message;
  item.style.color = "#64748b";
  item.style.fontSize = "13px";
  item.style.lineHeight = "1.8";

  searchResults.appendChild(item);
}

function resetSummary(message) {
  apartmentName.textContent = message;
  latestPrice.textContent = "-";
  periodHigh.textContent = "-";
  periodLow.textContent = "-";
  periodAverage.textContent = "-";
  tradeCount.textContent = "-";

  insightText.textContent = apartments.length
    ? "조회 결과에서 단지와 전용면적을 선택해 주세요."
    : "지역과 기간을 선택하고 데이터를 조회해 주세요.";

  ApartmentCharts.clear();
}

function clearApartmentList(message = "먼저 데이터를 조회해 주세요.") {
  searchInput.value = "";
  searchInput.disabled = true;

  aptSelect.replaceChildren();

  const option = document.createElement("option");
  option.value = "";
  option.textContent = message;
  aptSelect.appendChild(option);
  aptSelect.disabled = true;

  searchMessage(message);
}

function setLoading(loading) {
  isLoading = loading;

  [
    loadButton,
    resetButton,
    queryMonth,
    regionSelect,
    periodSelect,
    serviceKeyInput,
    sidoSelect
  ].filter(Boolean).forEach(control => {
    control.disabled = loading;
  });

  resetButton.style.opacity = loading ? "0.5" : "1";
  resetButton.style.cursor = loading ? "not-allowed" : "pointer";

  loadButton.textContent = loading
    ? "실거래를 불러오는 중…"
    : "실거래 조회하기";
}

function showApartment(apartment) {
  if (!apartment || !apartment.trades.length) {
    resetSummary("거래 내역이 없습니다.");
    return;
  }

  let sum = 0;
  let high = -Infinity;
  let low = Infinity;
  let latestDate = "";

  apartment.trades.forEach(trade => {
    sum += trade.price;
    high = Math.max(high, trade.price);
    low = Math.min(low, trade.price);

    if (trade.date > latestDate) {
      latestDate = trade.date;
    }
  });

  let latestLow = Infinity;
  let latestHigh = -Infinity;
  let latestCount = 0;

  apartment.trades.forEach(trade => {
    if (trade.date === latestDate) {
      latestLow = Math.min(latestLow, trade.price);
      latestHigh = Math.max(latestHigh, trade.price);
      latestCount++;
    }
  });

  apartmentName.textContent = apartment.label;

  latestPrice.textContent = latestLow === latestHigh
    ? formatPrice(latestLow)
    : formatPrice(latestLow) + " ~ " + formatPrice(latestHigh);

  periodHigh.textContent = formatPrice(high);
  periodLow.textContent = formatPrice(low);

  periodAverage.textContent = formatPrice(
    sum / apartment.trades.length
  );

  tradeCount.textContent = apartment.trades.length + "건";

  insightText.textContent =
    periodDescription(loadedMonths) +
    "의 해제되지 않은 거래 " + apartment.trades.length +
    "건을 분석했습니다. 최근 계약일은 " + latestDate +
    "이며, 해당 날짜의 거래는 " + latestCount + "건입니다.";

  ApartmentCharts.draw(apartment);
}

// 공백·영문 대소문자 차이를 줄여 검색
function normalizeSearch(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase("ko-KR");
}

function renderResults(keyword = "") {
  const previousSelection = aptSelect.value;
  const normalizedKeyword = normalizeSearch(keyword);

  const matched = apartments.filter(apartment => {
    return normalizeSearch(apartment.name).includes(normalizedKeyword);
  });

  aptSelect.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = matched.length
    ? "단지·전용면적을 선택해 주세요"
    : "검색 결과가 없습니다";

  aptSelect.appendChild(placeholder);

  matched.forEach(apartment => {
    const option = document.createElement("option");
    option.value = apartment.id;
    option.textContent = apartment.label;
    aptSelect.appendChild(option);
  });

  aptSelect.disabled = matched.length === 0;

  if (!matched.length) {
    searchMessage(
      "검색 결과가 없어요. 아파트명의 일부만 입력하거나 검색어를 지워 보세요."
    );
    resetSummary("검색 조건에 맞는 아파트가 없습니다.");
    return;
  }

  // 결과가 하나면 별도로 선택하지 않아도 바로 표시
  if (matched.length === 1) {
    aptSelect.value = matched[0].id;
    searchMessage("검색 결과 1개 · 해당 단지·전용면적을 자동으로 선택했어요.");
    showApartment(matched[0]);
    return;
  }

  searchMessage(
    (normalizedKeyword ? "검색 결과 " : "조회된 단지·면적 ") +
    matched.length.toLocaleString("ko-KR") +
    "개 · 아래 선택창에서 단지·전용면적을 골라 주세요."
  );

  // 검색어를 바꿔도 현재 선택이 결과에 남아 있으면 유지
  const previousApartment = matched.find(
    apartment => apartment.id === previousSelection
  );

  if (previousApartment) {
    aptSelect.value = previousApartment.id;
    showApartment(previousApartment);
  } else {
    resetSummary("아래 선택창에서 단지·전용면적을 선택해 주세요.");
  }
}

function saveDataset(dataset) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    return true;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 저장소 접근이 제한되면 현재 화면에서만 사용
    }

    return false;
  }
}

function validDataset(dataset) {
  return Boolean(
    dataset &&
    dataset.version === 2 &&
    dataset.source === "molit" &&
    typeof dataset.regionCode === "string" &&
    /^\d{5}$/.test(dataset.regionCode) &&
    Array.isArray(dataset.months) &&
    [1, 3, 6, 12].includes(dataset.months.length) &&
    dataset.months.every(month =>
      typeof month === "string" &&
      /^\d{4}(0[1-9]|1[0-2])$/.test(month)
    ) &&
    Array.isArray(dataset.apartments) &&
    dataset.apartments.every(apartment =>
      apartment &&
      typeof apartment.id === "string" &&
      typeof apartment.name === "string" &&
      typeof apartment.label === "string" &&
      Number.isFinite(apartment.area) &&
      apartment.area > 0 &&
      Array.isArray(apartment.trades) &&
      apartment.trades.length > 0 &&
      apartment.trades.every(trade =>
        trade &&
        typeof trade.date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(trade.date) &&
        Number.isFinite(trade.price) &&
        trade.price > 0
      )
    )
  );
}

function restoreDataset() {
  try {
    const dataset = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY)
    );

    if (!validDataset(dataset)) return false;

    const endMonth = dataset.months[dataset.months.length - 1];

    const expected = ApartmentAPI.getMonths(
      endMonth,
      dataset.months.length
    );

    if (JSON.stringify(expected) !== JSON.stringify(dataset.months)) {
      return false;
    }

    const sidoCode = dataset.regionCode.slice(0, 2);

    if (
      sidoSelect &&
      Array.from(sidoSelect.options).some(
        option => option.value === sidoCode
      ) &&
      sidoSelect.value !== sidoCode
    ) {
      sidoSelect.value = sidoCode;
      sidoSelect.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    }

    const supported = Array.from(regionSelect.options).some(
      option => option.value === dataset.regionCode
    );

    if (!supported) return false;

    regionSelect.value = dataset.regionCode;
    regionSelect.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    apartments = dataset.apartments;
    loadedMonths = dataset.months;

    queryMonth.value = formatMonth(endMonth);
    periodSelect.value = String(loadedMonths.length);
    searchInput.value = "";

    if (apartments.length) {
      searchInput.disabled = false;
      renderResults("");
    } else {
      clearApartmentList("조회 기간에 분석할 거래가 없습니다.");
      resetSummary("조회된 거래가 없습니다.");
    }

    loadStatus.textContent =
      "저장 결과 복원 · " + periodDescription(loadedMonths) +
      " · 단지·전용면적 조합 " + apartments.length + "개";

    return true;
  } catch {
    return false;
  }
}

resetButton.addEventListener("click", () => {
  if (isLoading) return;

  let cleared = true;

  [STORAGE_KEY, COMPARE_KEY, BUDGET_KEY].forEach(key => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      cleared = false;
    }
  });

  apartments = [];
  loadedMonths = [];

  clearApartmentList();
  resetSummary("조회 결과를 초기화했습니다.");

  const banner = document.getElementById("resultBanner");
  if (banner) banner.hidden = true;

  loadStatus.textContent = cleared
    ? "조회 결과와 비교 선택을 초기화했습니다. 지역·기간·입력한 인증키는 유지됩니다."
    : "현재 화면은 초기화했지만 저장 데이터 일부를 지우지 못했습니다.";
});

loadButton.addEventListener("click", async () => {
  if (isLoading) return;

  const key = serviceKeyInput.value.trim();
  const endMonth = queryMonth.value.replace("-", "");
  const region = regionSelect.value;
  const count = Number(periodSelect.value);
  const regionName = selectedRegionName();

  if (!key) {
    loadStatus.textContent = "일반 인증키를 입력해 주세요.";
    serviceKeyInput.focus();
    return;
  }

  if (!/^\d{5}$/.test(region)) {
    loadStatus.textContent = "조회할 시/군/구를 선택해 주세요.";
    return;
  }

  let months;

  try {
    months = ApartmentAPI.getMonths(endMonth, count);
  } catch (error) {
    loadStatus.textContent = error.message;
    return;
  }

  setLoading(true);

  apartments = [];
  loadedMonths = [];

  clearApartmentList("데이터를 불러오는 중입니다.");
  resetSummary("데이터 조회 중입니다.");

  try {
    const result = await ApartmentAPI.fetchPeriod(
      key,
      region,
      endMonth,
      count,
      progress => {
        loadStatus.textContent =
          regionName + " · " + formatMonth(progress.month) +
          " 처리 중 · " + progress.completed +
          "/" + progress.total + "개월 완료";
      }
    );

    apartments = ApartmentAPI.groupApartments(result.trades);
    loadedMonths = result.months;

    const saved = saveDataset({
      version: 2,
      source: "molit",
      regionCode: region,
      regionName,
      months: loadedMonths,
      fetchedAt: new Date().toISOString(),
      apartments
    });

    if (apartments.length) {
      searchInput.disabled = false;
      renderResults("");
    } else {
      clearApartmentList("조회 기간에 분석할 거래가 없습니다.");
      resetSummary("조회된 거래가 없습니다.");
    }

    loadStatus.textContent =
      regionName + " · " + periodDescription(loadedMonths) +
      " · 유효한 거래 " + result.trades.length +
      "건 · 단지·전용면적 조합 " + apartments.length +
      "개 · " + (saved ? "저장 완료" : "저장 실패");

    if (!saved) {
      loadStatus.textContent +=
        " · 현재 시세 화면은 사용할 수 있지만 다른 페이지로 결과를 전달하지 못했습니다.";
    }
  } catch (error) {
    loadStatus.textContent =
      "조회 실패: " + error.message +
      " 이전 저장 결과가 있다면 새로고침으로 복원할 수 있습니다.";

    clearApartmentList("조회를 완료하지 못했습니다.");
    resetSummary("전체 기간 조회를 완료하지 못했습니다.");
  } finally {
    setLoading(false);
  }
});

searchInput.addEventListener("input", () => {
  renderResults(searchInput.value.trim());
});

aptSelect.addEventListener("change", () => {
  const apartment = apartments.find(
    item => item.id === aptSelect.value
  );

  if (apartment) {
    showApartment(apartment);
  } else {
    resetSummary("단지·전용면적을 선택해 주세요.");
  }
});

function initializeMain() {
  if (!restoreDataset()) {
    clearApartmentList();
    resetSummary("인증키와 조회 기간을 선택하고 조회해 주세요.");
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMain);
} else {
  initializeMain();
}