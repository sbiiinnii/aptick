const rankingCriteria = document.querySelector("#rankingCriteria");
const areaFilter = document.querySelector("#areaFilter");
const rankingBody = document.querySelector("#rankingBody");
const rankingDescription = document.querySelector("#rankingDescription");
const datasetInfo = document.querySelector("#datasetInfo");

let rankingData = [];

// 기존 HTML의 한 달 전용 문구 수정
document.querySelector("caption").textContent =
  "조회 기간의 단지·전용면적별 거래 순위";

function formatRankingPrice(price) {
  const rounded = Math.round(price);
  const eok = Math.floor(rounded / 10000);
  const man = rounded % 10000;

  if (eok === 0) {
    return man.toLocaleString("ko-KR") + "만 원";
  }

  if (man === 0) {
    return eok.toLocaleString("ko-KR") + "억 원";
  }

  return eok.toLocaleString("ko-KR") +
    "억 " + man.toLocaleString("ko-KR") + "만 원";
}

function isValidApartment(apartment) {
  return (
    apartment &&
    typeof apartment.label === "string" &&
    Number.isFinite(apartment.area) &&
    apartment.area > 0 &&
    Array.isArray(apartment.trades) &&
    apartment.trades.length > 0 &&
    apartment.trades.every(function (trade) {
      return Number.isFinite(trade.price) && trade.price > 0;
    })
  );
}

function matchesArea(apartment) {
  switch (areaFilter.value) {
    case "under60":
      return apartment.area < 60;

    case "60to85":
      return apartment.area >= 60 && apartment.area <= 85;

    case "over85":
      return apartment.area > 85;

    default:
      return true;
  }
}

function appendCell(row, value, heading = false) {
  const cell = document.createElement(heading ? "th" : "td");

  cell.textContent = value;
  cell.style.padding = "14px 12px";
  cell.style.borderBottom = "1px solid #e5e7eb";
  cell.style.textAlign = "left";
  cell.style.whiteSpace = "nowrap";

  if (heading) {
    cell.scope = "row";
  }

  row.appendChild(cell);
}

function renderRanking() {
  const criteria = rankingCriteria.value;

  const sorted = rankingData.filter(matchesArea).sort(function (a, b) {
    return (
      b[criteria] - a[criteria] ||
      a.label.localeCompare(b.label, "ko")
    );
  });

  rankingBody.replaceChildren();

  let rank = 0;

  sorted.forEach(function (apartment, index) {
    if (
      index === 0 ||
      apartment[criteria] !== sorted[index - 1][criteria]
    ) {
      rank = index + 1;
    }

    const row = document.createElement("tr");

    appendCell(row, rank + "위");
    appendCell(row, apartment.label, true);
    appendCell(row, formatRankingPrice(apartment.average));
    appendCell(
      row,
      apartment.unitPrice.toLocaleString("ko-KR") + "만 원/㎡"
    );
    appendCell(row, apartment.count + "건");

    rankingBody.appendChild(row);
  });

  const criteriaLabel =
    rankingCriteria.options[rankingCriteria.selectedIndex].textContent;

  rankingDescription.textContent = sorted.length === 0
    ? "선택한 면적 조건에 해당하는 거래가 없습니다."
    : criteriaLabel + " · 단지·전용면적 조합 " + sorted.length + "개";
}

function initializeRanking() {
  try {
    const saved = sessionStorage.getItem("aptick.actualTrades.v2");

    if (!saved) {
      datasetInfo.textContent = "새 형식으로 저장된 조회 결과가 없습니다.";
      rankingDescription.textContent =
        "같은 탭에서 시세 페이지로 이동해 조회를 완료해 주세요.";
      return;
    }

    const dataset = JSON.parse(saved);

    if (
      !dataset ||
      dataset.version !== 2 ||
      dataset.source !== "molit" ||
      !Array.isArray(dataset.months) ||
      ![1, 3, 6, 12].includes(dataset.months.length) ||
      !dataset.months.every(function (month) {
        return typeof month === "string" && /^\d{6}$/.test(month);
      }) ||
      !Array.isArray(dataset.apartments) ||
      !dataset.apartments.every(isValidApartment)
    ) {
      throw new Error("저장 데이터 형식 오류");
    }

    rankingData = dataset.apartments.map(function (apartment) {
      const total = apartment.trades.reduce(function (sum, trade) {
        return sum + trade.price;
      }, 0);

      const average = total / apartment.trades.length;

      return {
        label: apartment.label,
        area: apartment.area,
        average: Math.round(average),
        unitPrice: Math.round(average / apartment.area),
        count: apartment.trades.length
      };
    });

    const first = dataset.months[0];
    const last = dataset.months[dataset.months.length - 1];

    datasetInfo.textContent =
      "조회 기간: " +
      first.slice(0, 4) + "-" + first.slice(4) + " ~ " +
      last.slice(0, 4) + "-" + last.slice(4) +
      " · " + dataset.months.length +
      "개월 · 지역 코드: " + dataset.regionCode;

    rankingCriteria.disabled = false;
    areaFilter.disabled = false;

    renderRanking();
  } catch {
    datasetInfo.textContent = "저장된 조회 결과를 읽을 수 없습니다.";
    rankingDescription.textContent =
      "시세 페이지에서 데이터를 다시 조회해 주세요.";
  }
}

rankingCriteria.addEventListener("change", renderRanking);
areaFilter.addEventListener("change", renderRanking);

initializeRanking();