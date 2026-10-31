const ApartmentCharts = (() => {
  "use strict";

  const namespace = "http://www.w3.org/2000/svg";
  const $ = id => document.getElementById(id);

  let activeCleanup = null;
  let currentApartment = null;
  let selectedPeriod = "all";

  function svgElement(tag, attributes = {}, text, parent) {
    const element = document.createElementNS(namespace, tag);

    Object.entries(attributes).forEach(([name, value]) => {
      element.setAttribute(name, String(value));
    });

    if (text !== undefined) element.textContent = text;
    if (parent) parent.appendChild(element);

    return element;
  }

  function money(value) {
    const rounded = Math.round(value);

    if (rounded === 0) return "0원";

    const eok = Math.floor(rounded / 10000);
    const man = rounded % 10000;

    if (!eok) return man.toLocaleString("ko-KR") + "만 원";
    if (!man) return eok.toLocaleString("ko-KR") + "억 원";

    return eok.toLocaleString("ko-KR") + "억 " +
      man.toLocaleString("ko-KR") + "만 원";
  }

  function formatMonth(month) {
    return month.slice(0, 4) + "년 " +
      Number(month.slice(4)) + "월";
  }

  function shortMonth(month) {
    return month.slice(0, 4) + "." + month.slice(4);
  }

  function validMonths(value) {
    return Array.isArray(value) &&
      value.length > 0 &&
      value.every(month =>
        typeof month === "string" &&
        /^\d{4}(0[1-9]|1[0-2])$/.test(month)
      );
  }

  function getMonths(apartment) {
    if (
      typeof loadedMonths !== "undefined" &&
      validMonths(loadedMonths)
    ) {
      return [...loadedMonths];
    }

    try {
      const saved = JSON.parse(
        sessionStorage.getItem("aptick.actualTrades.v2")
      );

      if (validMonths(saved?.months)) return [...saved.months];
    } catch {
      // 저장 데이터를 읽지 못하면 거래 날짜로 기간 구성
    }

    const tradeMonths = apartment.trades
      .map(trade => trade.date.slice(0, 7).replace("-", ""))
      .filter(month => /^\d{4}(0[1-9]|1[0-2])$/.test(month))
      .sort();

    if (!tradeMonths.length) return [];

    const first = tradeMonths[0];
    const last = tradeMonths[tradeMonths.length - 1];

    const months = [];
    let year = Number(first.slice(0, 4));
    let month = Number(first.slice(4));

    while (true) {
      const value = String(year).padStart(4, "0") +
        String(month).padStart(2, "0");

      months.push(value);
      if (value === last) break;

      month++;

      if (month > 12) {
        year++;
        month = 1;
      }
    }

    return months;
  }

  function disposeChart() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    const chart = $("priceChart");

    if (chart) {
      chart.replaceChildren();
      chart.style.display = "none";
      chart.removeAttribute("tabindex");
      chart.removeAttribute("aria-describedby");
    }

    $("combinedChartTableBody")?.replaceChildren();

    if ($("combinedChartHint")) {
      $("combinedChartHint").hidden = true;
    }

    if ($("combinedChartTable")) {
      $("combinedChartTable").hidden = true;
    }

    if ($("chartAccessibleStatus")) {
      $("chartAccessibleStatus").textContent = "";
    }

    if ($("volumeChart")) {
      $("volumeChart").replaceChildren();
      $("volumeChart").closest("section").hidden = true;
    }
  }

  function updatePeriodButtons(availableCount) {
    document.querySelectorAll(
      "#chartPeriodButtons button[data-period]"
    ).forEach(button => {
      const value = button.dataset.period;

      button.disabled = !currentApartment ||
        (value !== "all" && Number(value) > availableCount);

      button.setAttribute(
        "aria-pressed",
        String(value === selectedPeriod)
      );

      button.title = button.disabled
        ? "해당 기간을 보려면 시세에서 더 긴 기간을 조회해 주세요."
        : value === "all"
          ? "전체 조회 기간 표시"
          : "조회 종료 월을 포함한 최근 " + value + "개월 표시";
    });
  }

  function clear() {
    currentApartment = null;
    disposeChart();
    updatePeriodButtons(0);

    if ($("chartDescription")) {
      $("chartDescription").textContent =
        "아파트를 선택하면 가격 흐름과 거래량을 함께 보여드립니다.";
    }

    if ($("chartPeriodNote")) {
      $("chartPeriodNote").textContent =
        "기간 버튼은 조회한 데이터 안에서 차트만 변경합니다.";
    }
  }

  function renderTable(series) {
    const body = $("combinedChartTableBody");
    if (!body) return;

    series.forEach(item => {
      const row = document.createElement("tr");

      [
        formatMonth(item.month),
        item.average === null ? "거래 없음" : money(item.average),
        item.count + "건"
      ].forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");

        if (index === 0) cell.scope = "row";

        cell.textContent = value;
        cell.style.padding = "12px";
        cell.style.textAlign = "left";
        cell.style.borderBottom = "1px solid #e2e8f0";

        row.appendChild(cell);
      });

      body.appendChild(row);
    });

    $("combinedChartTable").hidden = false;
  }

  function render() {
    disposeChart();

    const apartment = currentApartment;
    if (!apartment) return;

    const allMonths = getMonths(apartment);

    if (
      selectedPeriod !== "all" &&
      Number(selectedPeriod) > allMonths.length
    ) {
      selectedPeriod = "all";
    }

    updatePeriodButtons(allMonths.length);

    const months = selectedPeriod === "all"
      ? allMonths
      : allMonths.slice(-Number(selectedPeriod));

    if (!months.length) return;

    const series = months.map(month => {
      const trades = apartment.trades.filter(trade => {
        return trade.date.slice(0, 7).replace("-", "") === month &&
          Number.isFinite(trade.price) &&
          trade.price > 0;
      });

      const total = trades.reduce(
        (sum, trade) => sum + trade.price,
        0
      );

      return {
        month,
        count: trades.length,
        average: trades.length ? total / trades.length : null
      };
    });

    const totalCount = series.reduce(
      (sum, item) => sum + item.count,
      0
    );

    $("chartDescription").textContent =
      apartment.label + " · " +
      shortMonth(months[0]) + " ~ " +
      shortMonth(months[months.length - 1]) +
      " · 거래 " + totalCount + "건";

    $("chartPeriodNote").textContent =
      "조회 " + allMonths.length + "개월 중 " +
      months.length + "개월 표시 · " +
      "최근 거래가와 주요 지표는 전체 조회 기간 기준입니다. " +
      "거래 없는 달은 가격선을 연결하지 않습니다.";

    renderTable(series);

    const chart = $("priceChart");
    if (!chart) return;

    chart.style.display = "block";
    chart.style.width = "100%";
    chart.style.height = "auto";
    chart.style.minWidth = "560px";
    chart.setAttribute("viewBox", "0 0 860 470");
    chart.setAttribute(
      "aria-label",
      apartment.label + "의 표시 기간 월별 평균 거래가와 거래량"
    );

    function add(tag, attributes, text, parent = chart) {
      return svgElement(tag, attributes, text, parent);
    }

    add("title", {}, apartment.label + "의 월별 평균 거래가와 거래량");

    const prices = series
      .filter(item => item.average !== null)
      .map(item => item.average / 10000);

    // 선택한 짧은 기간에 거래가 없을 수도 있음
    if (!prices.length) {
      add("text", {
        x: 430,
        y: 215,
        "text-anchor": "middle",
        fill: "#64748b",
        "font-size": 18
      }, "선택한 표시 기간에는 거래가 없습니다.");

      add("text", {
        x: 430,
        y: 250,
        "text-anchor": "middle",
        fill: "#64748b",
        "font-size": 14
      }, "전체 또는 더 긴 표시 기간을 선택해 주세요.");

      return;
    }

    chart.setAttribute("tabindex", "0");
    chart.setAttribute(
      "aria-describedby",
      "combinedChartHint chartAccessibleStatus"
    );

    $("combinedChartHint").hidden = false;

    const left = 78;
    const right = 824;

    // 상단 상세 정보 영역 아래에 가격선 배치
    const priceTop = 130;
    const priceBottom = 278;
    const volumeTop = 338;
    const volumeBottom = 414;

    const minimum = Math.min(...prices);
    const maximum = Math.max(...prices);
    const padding = Math.max((maximum - minimum) * 0.18, 0.1);

    const low = Math.max(0, minimum - padding);
    const high = maximum + padding;

    const maxCount = Math.max(...series.map(item => item.count), 1);
    const spacing = (right - left) / months.length;
    const barWidth = Math.min(32, spacing * 0.5);

    const x = index => left + spacing * (index + 0.5);

    const priceY = value => priceBottom -
      (value - low) / (high - low) * (priceBottom - priceTop);

    const volumeY = count => volumeBottom -
      count / maxCount * (volumeBottom - volumeTop);

    add("text", {
      x: left,
      y: priceTop - 15,
      fill: "#64748b",
      "font-size": 12
    }, "월별 평균가 · 억 원 · 가격축은 0부터 시작하지 않을 수 있음");

    for (let index = 0; index <= 4; index++) {
      const value = low + (high - low) * index / 4;
      const y = priceY(value);

      add("line", {
        x1: left,
        x2: right,
        y1: y,
        y2: y,
        stroke: "#e2e8f0"
      });

      add("text", {
        x: left - 12,
        y: y + 4,
        fill: "#64748b",
        "font-size": 12,
        "text-anchor": "end"
      }, value.toFixed(2));
    }

    add("text", {
      x: left,
      y: 315,
      fill: "#475569",
      "font-size": 12,
      "font-weight": 700
    }, "거래량 · 건");

    add("line", {
      x1: left,
      x2: right,
      y1: volumeBottom,
      y2: volumeBottom,
      stroke: "#cbd5e1"
    });

    add("text", {
      x: left - 12,
      y: volumeTop + 4,
      fill: "#64748b",
      "font-size": 12,
      "text-anchor": "end"
    }, String(maxCount));

    add("text", {
      x: left - 12,
      y: volumeBottom + 4,
      fill: "#64748b",
      "font-size": 12,
      "text-anchor": "end"
    }, "0");

    let previous = null;

    series.forEach((item, index) => {
      const pointX = x(index);

      if (item.average === null) {
        previous = null;
      } else {
        const pointY = priceY(item.average / 10000);

        if (previous) {
          add("line", {
            x1: previous.x,
            y1: previous.y,
            x2: pointX,
            y2: pointY,
            stroke: "#2563eb",
            "stroke-width": 3
          });
        }

        add("circle", {
          cx: pointX,
          cy: pointY,
          r: 4.5,
          fill: "#2563eb",
          stroke: "white",
          "stroke-width": 1.5
        });

        previous = { x: pointX, y: pointY };
      }

      if (item.count > 0) {
        add("rect", {
          x: pointX - barWidth / 2,
          y: volumeY(item.count),
          width: barWidth,
          height: volumeBottom - volumeY(item.count),
          rx: 3,
          fill: "#93c5fd"
        });
      }

      add("text", {
        x: pointX,
        y: item.count > 0
          ? volumeY(item.count) - 7
          : volumeBottom - 7,
        fill: "#64748b",
        "font-size": 11,
        "text-anchor": "middle"
      }, String(item.count));

      add("text", {
        x: pointX,
        y: 442,
        fill: "#64748b",
        "font-size": 11,
        "text-anchor": "middle"
      }, item.month.slice(2, 4) + "." + item.month.slice(4));
    });

    const overlay = add("g", {
      "pointer-events": "none",
      "aria-hidden": "true"
    });

    const crosshair = add("line", {
      x1: left,
      x2: left,
      y1: priceTop,
      y2: volumeBottom,
      stroke: "#64748b",
      "stroke-dasharray": "4 4"
    }, undefined, overlay);

    const focusPoint = add("circle", {
      r: 7,
      fill: "#2563eb",
      stroke: "white",
      "stroke-width": 2
    }, undefined, overlay);

    // 상세 정보는 고정 영역에 표시해 가격선을 가리지 않음
    add("rect", {
      x: left,
      y: 8,
      width: right - left,
      height: 80,
      rx: 12,
      fill: "#172554"
    }, undefined, overlay);

    const monthText = add("text", {
      x: left + 18,
      y: 34,
      fill: "#bfdbfe",
      "font-size": 13
    }, "", overlay);

    const priceText = add("text", {
      x: left + 18,
      y: 65,
      fill: "white",
      "font-size": 19,
      "font-weight": 700
    }, "", overlay);

    const countText = add("text", {
      x: right - 18,
      y: 65,
      fill: "#dbeafe",
      "font-size": 14,
      "text-anchor": "end"
    }, "", overlay);

    let activeIndex = series.reduce((last, item, index) => {
      return item.average !== null ? index : last;
    }, 0);

    const status = $("chartAccessibleStatus");

    function showIndex(index, announce = true) {
      activeIndex = Math.max(0, Math.min(series.length - 1, index));

      const item = series[activeIndex];
      const pointX = x(activeIndex);

      crosshair.setAttribute("x1", pointX);
      crosshair.setAttribute("x2", pointX);

      focusPoint.setAttribute(
        "visibility",
        item.average === null ? "hidden" : "visible"
      );

      if (item.average !== null) {
        focusPoint.setAttribute("cx", pointX);
        focusPoint.setAttribute("cy", priceY(item.average / 10000));
      }

      monthText.textContent = formatMonth(item.month);
      priceText.textContent = item.average === null
        ? "거래 없음"
        : "평균 " + money(item.average);
      countText.textContent = "거래량 " + item.count + "건";

      const description =
        monthText.textContent + " · " +
        priceText.textContent + " · " + countText.textContent;

      if (announce && status && status.textContent !== description) {
        status.textContent = description;
      }
    }

    function onPointer(event) {
      const matrix = chart.getScreenCTM();
      if (!matrix) return;

      const point = chart.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;

      const position = point.matrixTransform(matrix.inverse());

      if (
        position.x < left ||
        position.x > right ||
        position.y < priceTop ||
        position.y > volumeBottom + 30
      ) {
        return;
      }

      showIndex(Math.floor((position.x - left) / spacing));
    }

    function onKeyDown(event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showIndex(activeIndex - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        showIndex(activeIndex + 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        showIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        showIndex(series.length - 1);
      }
    }

    function onFocus() {
      showIndex(activeIndex);
    }

    chart.addEventListener("pointermove", onPointer);
    chart.addEventListener("pointerdown", onPointer);
    chart.addEventListener("keydown", onKeyDown);
    chart.addEventListener("focus", onFocus);

    activeCleanup = () => {
      chart.removeEventListener("pointermove", onPointer);
      chart.removeEventListener("pointerdown", onPointer);
      chart.removeEventListener("keydown", onKeyDown);
      chart.removeEventListener("focus", onFocus);
    };

    showIndex(activeIndex, false);
  }

  function draw(apartment) {
    if (
      !apartment ||
      !Array.isArray(apartment.trades) ||
      !apartment.trades.length
    ) {
      clear();
      return;
    }

    currentApartment = apartment;
    render();
  }

  // index.html의 기간 버튼 연결
  document.querySelectorAll(
    "#chartPeriodButtons button[data-period]"
  ).forEach(button => {
    button.addEventListener("click", () => {
      if (!currentApartment || button.disabled) return;

      selectedPeriod = button.dataset.period;
      render();
    });
  });

  return {
    draw,
    clear
  };
})();