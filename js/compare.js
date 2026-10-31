(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const namespace = "http://www.w3.org/2000/svg";
  const selectionKey = "aptick.compareSelection.v1";
  const colors = ["#2563eb", "#7c3aed"];

  let apartments = [];
  let months = [];
  let mode = "actual";
  let selectedPeriod = "all";
  let chartCleanup = null;

  function money(value) {
    const rounded = Math.round(value);

    if (rounded === 0) return "0원";

    const eok = Math.floor(rounded / 10000);
    const man = rounded % 10000;

    if (!eok) return man.toLocaleString("ko-KR") + "만 원";
    if (!man) return eok.toLocaleString("ko-KR") + "억 원";

    return eok.toLocaleString("ko-KR") +
      "억 " + man.toLocaleString("ko-KR") + "만 원";
  }

  function monthLabel(month) {
    return month.slice(0, 4) + "년 " +
      Number(month.slice(4)) + "월";
  }

  function shortMonth(month) {
    return month.slice(0, 4) + "." + month.slice(4);
  }

  function differenceText(value) {
    if (value === 0) return "차이 없음";
    if (value < 1) return "1만 원 미만";
    return "약 " + money(value);
  }

  function getDisplayMonths() {
    if (selectedPeriod === "all") return [...months];

    return months.slice(-Number(selectedPeriod));
  }

  function saveSelection() {
    try {
      sessionStorage.setItem(
        selectionKey,
        JSON.stringify({
          a: $("aptASelect").value,
          b: $("aptBSelect").value,
          mode,
          period: selectedPeriod
        })
      );
    } catch {
      // 저장이 불가능해도 현재 화면의 비교 기능은 유지
    }
  }

  function restoreSelection() {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(selectionKey)
      );

      if (!saved || typeof saved !== "object") return;

      if (apartments.some(item => item.id === saved.a)) {
        $("aptASelect").value = saved.a;
      }

      if (apartments.some(item => item.id === saved.b)) {
        $("aptBSelect").value = saved.b;
      }

      if (saved.mode === "actual" || saved.mode === "index") {
        mode = saved.mode;
      }

      if (
        ["all", "1", "3", "6", "12"].includes(saved.period) &&
        (
          saved.period === "all" ||
          Number(saved.period) <= months.length
        )
      ) {
        selectedPeriod = saved.period;
      }
    } catch {
      // 저장된 선택을 읽을 수 없으면 기본값 사용
    }
  }

  function renderModeButtons() {
    $("actualMode").setAttribute(
      "aria-pressed",
      String(mode === "actual")
    );

    $("indexMode").setAttribute(
      "aria-pressed",
      String(mode === "index")
    );
  }

  function preparePeriodButtons() {
    if ($("comparisonPeriodButtons")) return;

    const container = document.createElement("div");
    container.id = "comparisonPeriodButtons";
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", "비교 차트 표시 기간");

    Object.assign(container.style, {
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      margin: "18px 0 10px"
    });

    [
      { value: "all", label: "전체" },
      { value: "1", label: "1개월" },
      { value: "3", label: "3개월" },
      { value: "6", label: "6개월" },
      { value: "12", label: "12개월" }
    ].forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.dataset.period = item.value;
      button.textContent = item.label;

      Object.assign(button.style, {
        padding: "8px 12px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "700"
      });

      button.addEventListener("click", () => {
        if (button.disabled) return;

        selectedPeriod = item.value;
        update();
      });

      container.appendChild(button);
    });

    $("chartNote").before(container);

    const note = document.createElement("p");
    note.id = "comparisonPeriodNote";
    note.className = "muted";
    note.style.lineHeight = "1.8";

    container.after(note);
  }

  function renderPeriodButtons() {
    const container = $("comparisonPeriodButtons");
    if (!container) return;

    container.querySelectorAll("button").forEach(button => {
      const value = button.dataset.period;

      const disabled =
        months.length === 0 ||
        (value !== "all" && Number(value) > months.length);

      const active = value === selectedPeriod;

      button.disabled = disabled;
      button.setAttribute("aria-pressed", String(active));

      button.style.background = active ? "#2563eb" : "#f8fafc";
      button.style.color = active ? "white" : "#475569";
      button.style.border = active
        ? "1px solid #2563eb"
        : "1px solid #e2e8f0";
      button.style.opacity = disabled ? "0.4" : "1";
      button.style.cursor = disabled ? "not-allowed" : "pointer";

      button.title = disabled
        ? "해당 기간을 보려면 시세에서 더 긴 기간을 조회해 주세요."
        : value === "all"
          ? "전체 조회 기간 표시"
          : "조회 종료 월을 포함한 최근 " + value + "개월 표시";
    });

    const displayed = getDisplayMonths();

    if (displayed.length) {
      $("comparisonPeriodNote").textContent =
        shortMonth(displayed[0]) + " ~ " +
        shortMonth(displayed[displayed.length - 1]) +
        " · 조회 " + months.length + "개월 중 " +
        displayed.length + "개월 표시. " +
        "기간 버튼은 차트와 월별 표만 변경하며, " +
        "카드·가격 차이·항목별 막대는 전체 조회 기간 기준입니다.";
    }
  }

  function monthly(apartment, displayMonths) {
    return displayMonths.map(month => {
      const trades = apartment.trades.filter(trade => {
        return trade.date.slice(0, 7).replace("-", "") === month;
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
  }

  function analyze(apartment) {
    let sum = 0;
    let high = -Infinity;
    let low = Infinity;
    let date = "";

    apartment.trades.forEach(trade => {
      sum += trade.price;
      high = Math.max(high, trade.price);
      low = Math.min(low, trade.price);

      if (trade.date > date) date = trade.date;
    });

    let latestLow = Infinity;
    let latestHigh = -Infinity;

    apartment.trades.forEach(trade => {
      if (trade.date === date) {
        latestLow = Math.min(latestLow, trade.price);
        latestHigh = Math.max(latestHigh, trade.price);
      }
    });

    const average = sum / apartment.trades.length;

    return {
      average,
      unit: average / apartment.area,
      count: apartment.trades.length,
      high,
      low,
      date,
      latestLow,
      latestHigh
    };
  }

  function normalizedSeries(seriesA, seriesB) {
    const baseline = seriesA.findIndex((item, index) => {
      return item.average !== null &&
        seriesB[index].average !== null;
    });

    if (baseline < 0) return null;

    return {
      baseline,
      values: [seriesA, seriesB].map(series => {
        return series.map((item, index) => {
          if (index < baseline || item.average === null) {
            return null;
          }

          return item.average / series[baseline].average * 100;
        });
      })
    };
  }

  function renderCard(side, apartment, stats) {
    $("average" + side).textContent = money(stats.average);

    $("note" + side).textContent =
      "전용 " + apartment.area + "㎡ · 전체 조회 기간 거래 " +
      stats.count + "건";

    $("unit" + side).textContent =
      Math.round(stats.unit).toLocaleString("ko-KR") + "만 원/㎡";

    $("range" + side).textContent =
      money(stats.high) + " / " + money(stats.low);

    $("date" + side).textContent = stats.date;

    $("latest" + side).textContent =
      stats.latestLow === stats.latestHigh
        ? money(stats.latestLow)
        : money(stats.latestLow) + " ~ " + money(stats.latestHigh);

    $("legend" + side).textContent =
      side + " · " + apartment.label;
  }

  function renderBars(statsA, statsB) {
    const container = $("metricBars");
    container.replaceChildren();

    const metrics = [
      {
        title: "전체 조회 기간 평균 거래가",
        values: [statsA.average, statsB.average],
        format: money
      },
      {
        title: "평균 ㎡당 가격",
        values: [statsA.unit, statsB.unit],
        format: value =>
          Math.round(value).toLocaleString("ko-KR") + "만 원/㎡"
      },
      {
        title: "전체 조회 기간 거래 건수",
        values: [statsA.count, statsB.count],
        format: value => value + "건"
      }
    ];

    metrics.forEach(metric => {
      const card = document.createElement("div");
      card.className = "metric";

      const heading = document.createElement("h3");
      heading.textContent = metric.title;
      card.appendChild(heading);

      const maximum = Math.max(...metric.values, 1);

      metric.values.forEach((value, index) => {
        const row = document.createElement("div");
        row.className = "bar-row";

        const label = document.createElement("div");
        label.className = "bar-label";

        const name = document.createElement("span");
        name.textContent = index === 0 ? "A" : "B";

        const text = document.createElement("strong");
        text.textContent = metric.format(value);
        label.append(name, text);

        const track = document.createElement("div");
        track.className = "bar-track";
        track.setAttribute("aria-hidden", "true");

        const bar = document.createElement("div");
        bar.className = "bar " + (index === 0 ? "bar-a" : "bar-b");
        bar.style.width = value / maximum * 100 + "%";

        track.appendChild(bar);
        row.append(label, track);
        card.appendChild(row);
      });

      container.appendChild(card);
    });
  }

  function svg(
    tag,
    attributes = {},
    text,
    parent = $("comparisonChart")
  ) {
    const element = document.createElementNS(namespace, tag);

    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });

    if (text !== undefined) element.textContent = text;

    parent.appendChild(element);
    return element;
  }

  function renderMonthlyTable(seriesA, seriesB, displayMonths) {
    const body = $("monthlyBody");
    body.replaceChildren();

    displayMonths.forEach((month, index) => {
      const row = document.createElement("tr");

      const values = [
        month.slice(0, 4) + "-" + month.slice(4),
        seriesA[index].average === null
          ? "—"
          : Math.round(seriesA[index].average).toLocaleString("ko-KR"),
        seriesA[index].count,
        seriesB[index].average === null
          ? "—"
          : Math.round(seriesB[index].average).toLocaleString("ko-KR"),
        seriesB[index].count
      ];

      values.forEach((value, cellIndex) => {
        const cell = document.createElement(
          cellIndex === 0 ? "th" : "td"
        );

        if (cellIndex === 0) cell.scope = "row";

        cell.textContent = value;
        row.appendChild(cell);
      });

      body.appendChild(row);
    });
  }

  function prepareChartHelp() {
    const chart = $("comparisonChart");

    let help = $("comparisonInteractionHelp");

    if (!help) {
      help = document.createElement("p");
      help.id = "comparisonInteractionHelp";
      help.className = "muted";
      help.textContent =
        "차트에 마우스를 올리거나 터치하면 같은 월의 A·B 정보를 확인할 수 있어요. " +
        "차트를 선택한 뒤 좌우 방향키로도 이동할 수 있어요. " +
        "좁은 화면에서는 차트를 좌우로 스크롤할 수 있어요.";

      chart.parentElement.after(help);
    }

    let status = $("comparisonAccessibleStatus");

    if (!status) {
      status = document.createElement("p");
      status.id = "comparisonAccessibleStatus";
      status.setAttribute("role", "status");

      Object.assign(status.style, {
        position: "absolute",
        width: "1px",
        height: "1px",
        overflow: "hidden",
        clipPath: "inset(50%)"
      });

      help.after(status);
    }

    status.textContent = "";

    return { help, status };
  }

  function drawChart(seriesA, seriesB, displayMonths) {
    if (chartCleanup) {
      chartCleanup();
      chartCleanup = null;
    }

    const chart = $("comparisonChart");
    chart.replaceChildren();
    chart.removeAttribute("tabindex");

    const { help, status } = prepareChartHelp();
    help.hidden = true;

    renderMonthlyTable(seriesA, seriesB, displayMonths);

    let values;
    let normalized = null;

    if (mode === "index") {
      normalized = normalizedSeries(seriesA, seriesB);

      if (!normalized) {
        chart.style.display = "none";
        $("chartEmpty").hidden = false;

        $("chartEmpty").textContent =
          "선택한 표시 기간에는 두 아파트 모두 거래된 공통 월이 없어 " +
          "기준월 100을 계산할 수 없습니다.";

        $("chartNote").textContent =
          "더 긴 표시 기간을 선택하거나 실제 가격 보기로 전환해 주세요.";

        return;
      }

      values = normalized.values;

      $("chartNote").textContent =
        monthLabel(displayMonths[normalized.baseline]) +
        " = 100 · 선택한 표시 기간 안에서 두 대상 모두 거래가 있는 " +
        "첫 달을 기준으로 계산합니다. 기간을 바꾸면 기준월도 달라질 수 있습니다.";
    } else {
      values = [seriesA, seriesB].map(series => {
        return series.map(item =>
          item.average === null ? null : item.average / 10000
        );
      });

      $("chartNote").textContent =
        "월별 평균 거래가 · 단위: 억 원 · " +
        "거래 없는 달은 선을 연결하지 않습니다. " +
        "세로축은 0부터 시작하지 않을 수 있습니다.";
    }

    const allValues = values.flat().filter(value => value !== null);

    if (!allValues.length) {
      chart.style.display = "none";
      $("chartEmpty").hidden = false;

      $("chartEmpty").textContent =
        "선택한 표시 기간에는 두 대상의 거래가 없습니다. " +
        "전체 또는 더 긴 기간을 선택해 주세요.";

      return;
    }

    chart.style.display = "block";
    chart.setAttribute("viewBox", "0 0 860 470");
    chart.setAttribute("tabindex", "0");
    chart.setAttribute(
      "aria-describedby",
      "comparisonInteractionHelp comparisonAccessibleStatus"
    );

    $("chartEmpty").hidden = true;
    help.hidden = false;

    svg(
      "title",
      {},
      "선택한 표시 기간의 A와 B 월별 가격 비교"
    );

    const left = 80;
    const right = 820;
    const top = 190;
    const bottom = 405;

    const minimum = Math.min(...allValues);
    const maximum = Math.max(...allValues);

    const padding = Math.max(
      (maximum - minimum) * 0.15,
      mode === "index" ? 2 : 0.1
    );

    const low = Math.max(0, minimum - padding);
    const high = maximum + padding;
    const spacing = (right - left) / displayMonths.length;

    const x = index => left + spacing * (index + 0.5);

    const y = value =>
      bottom - (value - low) / (high - low) * (bottom - top);

    svg("text", {
      x: left,
      y: top - 14,
      fill: "#64748b",
      "font-size": 12
    }, mode === "index" ? "단위: 지수" : "단위: 억 원");

    for (let index = 0; index <= 4; index++) {
      const value = low + (high - low) * index / 4;
      const position = y(value);

      svg("line", {
        x1: left,
        x2: right,
        y1: position,
        y2: position,
        stroke: "#e2e8f0"
      });

      svg("text", {
        x: left - 12,
        y: position + 4,
        "text-anchor": "end",
        "font-size": 12,
        fill: "#64748b"
      }, value.toFixed(mode === "index" ? 1 : 2));
    }

    if (mode === "index") {
      svg("line", {
        x1: left,
        x2: right,
        y1: y(100),
        y2: y(100),
        stroke: "#94a3b8",
        "stroke-dasharray": "4 4"
      });
    }

    displayMonths.forEach((month, index) => {
      svg("text", {
        x: x(index),
        y: bottom + 26,
        "text-anchor": "middle",
        "font-size": 11,
        fill: "#64748b"
      }, month.slice(2, 4) + "." + month.slice(4));
    });

    values.forEach((series, side) => {
      let previous = null;

      series.forEach((value, index) => {
        if (value === null) {
          previous = null;
          return;
        }

        const point = { x: x(index), y: y(value) };

        if (previous) {
          svg("line", {
            x1: previous.x,
            y1: previous.y,
            x2: point.x,
            y2: point.y,
            stroke: colors[side],
            "stroke-width": 3,
            "stroke-dasharray": side === 1 ? "7 4" : "none"
          });
        }

        if (side === 0) {
          svg("circle", {
            cx: point.x,
            cy: point.y,
            r: 5,
            fill: colors[side],
            stroke: "white",
            "stroke-width": 1.5
          });
        } else {
          svg("rect", {
            x: point.x - 4.5,
            y: point.y - 4.5,
            width: 9,
            height: 9,
            fill: colors[side],
            stroke: "white",
            "stroke-width": 1.5
          });
        }

        previous = point;
      });
    });

    const overlay = svg("g", {
      "pointer-events": "none",
      "aria-hidden": "true"
    });

    const crosshair = svg("line", {
      x1: left,
      x2: left,
      y1: top,
      y2: bottom,
      stroke: "#64748b",
      "stroke-dasharray": "4 4"
    }, undefined, overlay);

    const focusA = svg("circle", {
      r: 7,
      fill: colors[0],
      stroke: "white",
      "stroke-width": 2
    }, undefined, overlay);

    const focusB = svg("rect", {
      width: 12,
      height: 12,
      fill: colors[1],
      stroke: "white",
      "stroke-width": 2
    }, undefined, overlay);

    const box = svg("g", {}, undefined, overlay);

    svg("rect", {
      x: left,
      y: 8,
      width: right - left,
      height: 142,
      rx: 12,
      fill: "#172554"
    }, undefined, box);

    const monthText = svg("text", {
      x: left + 18,
      y: 34,
      fill: "#bfdbfe",
      "font-size": 13,
      "font-weight": 700
    }, "", box);

    const textA = svg("text", {
      x: left + 18,
      y: 64,
      fill: "#93c5fd",
      "font-size": 14
    }, "", box);

    const textB = svg("text", {
      x: left + 18,
      y: 92,
      fill: "#d8b4fe",
      "font-size": 14
    }, "", box);

    const difference = svg("text", {
      x: left + 18,
      y: 122,
      fill: "white",
      "font-size": 14,
      "font-weight": 700
    }, "", box);

    let activeIndex = mode === "index"
      ? normalized.baseline
      : seriesA.reduce((last, item, index) => {
          return item.average !== null || seriesB[index].average !== null
            ? index
            : last;
        }, 0);

    function describeSide(side, index) {
      const item = side === 0 ? seriesA[index] : seriesB[index];
      const label = side === 0 ? "A" : "B";

      if (item.average === null) {
        return label + " · 거래 없음 · 0건";
      }

      const actual = money(item.average);

      if (mode === "actual") {
        return label + " · 평균 " + actual + " · " + item.count + "건";
      }

      const value = values[side][index];

      if (value === null) {
        return label + " · 기준월 이전 · 실제 평균 " +
          actual + " · " + item.count + "건";
      }

      return label + " · 지수 " + value.toFixed(2) +
        " · 실제 평균 " + actual + " · " + item.count + "건";
    }

    function showIndex(index, announce = true) {
      activeIndex = Math.max(
        0,
        Math.min(displayMonths.length - 1, index)
      );

      const itemA = seriesA[activeIndex];
      const itemB = seriesB[activeIndex];
      const pointX = x(activeIndex);

      crosshair.setAttribute("x1", pointX);
      crosshair.setAttribute("x2", pointX);

      const valueA = values[0][activeIndex];
      const valueB = values[1][activeIndex];

      focusA.setAttribute(
        "visibility",
        valueA === null ? "hidden" : "visible"
      );

      if (valueA !== null) {
        focusA.setAttribute("cx", pointX);
        focusA.setAttribute("cy", y(valueA));
      }

      focusB.setAttribute(
        "visibility",
        valueB === null ? "hidden" : "visible"
      );

      if (valueB !== null) {
        focusB.setAttribute("x", pointX - 6);
        focusB.setAttribute("y", y(valueB) - 6);
      }

      monthText.textContent = monthLabel(displayMonths[activeIndex]);
      textA.textContent = describeSide(0, activeIndex);
      textB.textContent = describeSide(1, activeIndex);

      if (itemA.average === null || itemB.average === null) {
        difference.textContent =
          "실제 평균가 차이 · 한쪽 이상 거래가 없어 계산하지 않습니다.";
      } else {
        const gap = Math.abs(itemA.average - itemB.average);

        const direction = gap < 1
          ? ""
          : " · " + (itemA.average > itemB.average ? "A" : "B") +
            "가 더 높음";

        difference.textContent =
          "실제 평균가 차이 · " + differenceText(gap) + direction;
      }

      if (announce) {
        const description = [
          monthText.textContent,
          textA.textContent,
          textB.textContent,
          difference.textContent
        ].join(" / ");

        if (status.textContent !== description) {
          status.textContent = description;
        }
      }
    }

    function onPointer(event) {
      const matrix = chart.getScreenCTM();
      if (!matrix) return;

      const point = chart.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;

      const local = point.matrixTransform(matrix.inverse());

      if (
        local.x < left ||
        local.x > right ||
        local.y < top ||
        local.y > bottom + 35
      ) {
        return;
      }

      showIndex(Math.floor((local.x - left) / spacing));
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
        showIndex(displayMonths.length - 1);
      }
    }

    function onFocus() {
      showIndex(activeIndex);
    }

    chart.addEventListener("pointermove", onPointer);
    chart.addEventListener("pointerdown", onPointer);
    chart.addEventListener("keydown", onKeyDown);
    chart.addEventListener("focus", onFocus);

    chartCleanup = () => {
      chart.removeEventListener("pointermove", onPointer);
      chart.removeEventListener("pointerdown", onPointer);
      chart.removeEventListener("keydown", onKeyDown);
      chart.removeEventListener("focus", onFocus);
    };

    showIndex(activeIndex, false);
  }

  function update() {
    const apartmentA = apartments.find(
      item => item.id === $("aptASelect").value
    );

    const apartmentB = apartments.find(
      item => item.id === $("aptBSelect").value
    );

    if (!apartmentA || !apartmentB) return;

    if (
      selectedPeriod !== "all" &&
      Number(selectedPeriod) > months.length
    ) {
      selectedPeriod = "all";
    }

    saveSelection();
    renderModeButtons();
    renderPeriodButtons();

    const statsA = analyze(apartmentA);
    const statsB = analyze(apartmentB);

    renderCard("A", apartmentA, statsA);
    renderCard("B", apartmentB, statsB);

    const gap = Math.abs(statsA.average - statsB.average);
    $("differenceValue").textContent = differenceText(gap);

    if (apartmentA.id === apartmentB.id) {
      $("differenceValue").textContent = "같은 비교 대상";
      $("comparisonText").textContent =
        "서로 다른 단지 또는 전용면적을 선택해 주세요.";
    } else {
      const direction = gap < 1
        ? "두 전체 평균가의 차이는 1만 원 미만입니다."
        : (statsA.average > statsB.average ? "A" : "B") +
          "의 전체 평균 거래가가 더 높습니다.";

      const areaNote = apartmentA.area === apartmentB.area
        ? "전용면적은 같지만 거래 시점과 주택 조건은 다를 수 있습니다."
        : "전용면적이 다릅니다. ㎡당 가격도 함께 확인하세요.";

      $("comparisonText").textContent =
        direction + " " + areaNote;
    }

    renderBars(statsA, statsB);

    const displayMonths = getDisplayMonths();

    drawChart(
      monthly(apartmentA, displayMonths),
      monthly(apartmentB, displayMonths),
      displayMonths
    );
  }

  function validApartment(apartment) {
    return Boolean(
      apartment &&
      typeof apartment.id === "string" &&
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
    );
  }

  function validMonths(value) {
    if (
      !Array.isArray(value) ||
      ![1, 3, 6, 12].includes(value.length) ||
      !value.every(month =>
        typeof month === "string" &&
        /^\d{4}(0[1-9]|1[0-2])$/.test(month)
      )
    ) {
      return false;
    }

    // 月が重複したり順番が逆になっていないか確認
    for (let index = 1; index < value.length; index++) {
      const previous = value[index - 1];

      let year = Number(previous.slice(0, 4));
      let month = Number(previous.slice(4)) + 1;

      if (month > 12) {
        year++;
        month = 1;
      }

      const expected = String(year).padStart(4, "0") +
        String(month).padStart(2, "0");

      if (value[index] !== expected) return false;
    }

    return true;
  }

  function initialize() {
    preparePeriodButtons();

    try {
      const data = JSON.parse(
        sessionStorage.getItem("aptick.actualTrades.v2")
      );

      if (!data) {
        throw new Error(
          "시세에서 먼저 지역과 기간을 조회해 주세요."
        );
      }

      if (
        data.version !== 2 ||
        data.source !== "molit" ||
        !validMonths(data.months) ||
        !Array.isArray(data.apartments) ||
        !data.apartments.every(validApartment)
      ) {
        throw new Error(
          "저장된 데이터를 읽을 수 없습니다. 시세에서 다시 조회해 주세요."
        );
      }

      if (!data.apartments.length) {
        throw new Error(
          "조회 기간에 분석할 거래가 없습니다. 다른 지역이나 기간으로 조회해 주세요."
        );
      }

      apartments = data.apartments;
      months = data.months;

      const first = months[0];
      const last = months[months.length - 1];

      $("datasetInfo").textContent =
        shortMonth(first) + " ~ " + shortMonth(last) +
        " · " + (data.regionName || "지역 코드 " + data.regionCode) +
        " · 실제 거래 데이터";

      ["aptASelect", "aptBSelect"].forEach(id => {
        const select = $(id);
        select.replaceChildren();

        apartments.forEach(apartment => {
          const option = document.createElement("option");
          option.value = apartment.id;
          option.textContent = apartment.label;
          select.appendChild(option);
        });

        select.addEventListener("change", update);
      });

      $("aptASelect").selectedIndex = 0;

      const comparableIndex = apartments.findIndex((apartment, index) => {
        return index > 0 && apartment.area === apartments[0].area;
      });

      $("aptBSelect").selectedIndex = comparableIndex >= 0
        ? comparableIndex
        : Math.min(1, apartments.length - 1);

      restoreSelection();
      update();

      $("aptASelect").disabled = false;
      $("aptBSelect").disabled = false;
      $("actualMode").disabled = false;
      $("indexMode").disabled = false;
    } catch (error) {
      if (chartCleanup) {
        chartCleanup();
        chartCleanup = null;
      }

      months = [];
      renderPeriodButtons();

      $("datasetInfo").textContent = error.message;
      $("comparisonText").textContent =
        "같은 탭에서 시세 페이지로 이동해 조회한 뒤 돌아오세요.";

      $("aptASelect").disabled = true;
      $("aptBSelect").disabled = true;
      $("actualMode").disabled = true;
      $("indexMode").disabled = true;

      $("comparisonChart").style.display = "none";
      $("chartEmpty").hidden = false;
      $("chartEmpty").textContent =
        "비교할 거래 데이터를 먼저 조회해 주세요.";

      if ($("comparisonInteractionHelp")) {
        $("comparisonInteractionHelp").hidden = true;
      }
    }
  }

  $("actualMode").addEventListener("click", () => {
    mode = "actual";
    update();
  });

  $("indexMode").addEventListener("click", () => {
    mode = "index";
    update();
  });

  initialize();
})();