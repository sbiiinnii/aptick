const ApartmentAPI = (() => {
  const endpoint =
    "https://apis.data.go.kr/1613000/" +
    "RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade";

  function readText(element, name) {
    return element.querySelector(name)?.textContent.trim() || "";
  }

  // 한 페이지 조회
  async function fetchPage(serviceKey, regionCode, month, pageNo) {
    const url = new URL(endpoint);

    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("LAWD_CD", regionCode);
    url.searchParams.set("DEAL_YMD", month);
    url.searchParams.set("pageNo", String(pageNo));
    url.searchParams.set("numOfRows", "100");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error("HTTP 오류: " + response.status);
    }

    const text = await response.text();
    const xml = new DOMParser().parseFromString(
      text,
      "application/xml"
    );

    if (xml.querySelector("parsererror")) {
      throw new Error("API 응답을 XML로 읽을 수 없습니다.");
    }

    const code = readText(xml, "resultCode");

    if (code !== "000" && code !== "00") {
      const message =
        readText(xml, "resultMsg") ||
        readText(xml, "returnAuthMsg") ||
        "API 인증 또는 요청 오류";

      throw new Error(message);
    }

    const totalText = readText(xml, "totalCount");
    const total = Number(totalText);

    if (!totalText || !Number.isInteger(total) || total < 0) {
      throw new Error("전체 거래 건수를 확인할 수 없습니다.");
    }

    return {
      items: Array.from(xml.querySelectorAll("item")),
      total: total
    };
  }

  // 거래 한 건 변환
  function parseTrade(item) {
    const cancellation = readText(item, "cdealType").toUpperCase();

    if (
      cancellation === "O" ||
      readText(item, "cdealDay") !== ""
    ) {
      return null;
    }

    const name = readText(item, "aptNm");
    const amountText = readText(item, "dealAmount");
    const areaText = readText(item, "excluUseAr");

    const price = Number(amountText.replace(/,/g, ""));
    const area = Number(areaText);

    const year = readText(item, "dealYear");
    const month = readText(item, "dealMonth").padStart(2, "0");
    const day = readText(item, "dealDay").padStart(2, "0");
    const date = year + "-" + month + "-" + day;

    const parsedDate = new Date(date + "T00:00:00Z");

    if (
      !name ||
      !amountText ||
      !areaText ||
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(area) ||
      area <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return null;
    }

    return {
      name: name,
      regionCode: readText(item, "sggCd"),
      neighborhood: readText(item, "umdNm"),
      addressNumber: readText(item, "jibun"),
      area: area,
      date: date,
      price: price,
      floor: readText(item, "floor")
    };
  }

  // 한 달의 전체 페이지 조회
  async function fetchMonth(serviceKey, regionCode, month) {
    const trades = [];
    let pageNo = 1;
    let receivedCount = 0;

    while (true) {
      const page = await fetchPage(
        serviceKey,
        regionCode,
        month,
        pageNo
      );

      if (page.items.length === 0 && receivedCount < page.total) {
        throw new Error(
          "전체 거래를 받기 전에 응답이 비었습니다. 다시 조회해 주세요."
        );
      }

      page.items.forEach(function (item) {
        const trade = parseTrade(item);

        if (trade) {
          trades.push(trade);
        }
      });

      receivedCount += page.items.length;

      if (receivedCount >= page.total) {
        break;
      }

      pageNo += 1;
    }

    return trades;
  }

  // 종료 월을 포함한 최근 N개월 목록 생성
  function getMonths(endMonth, count = 12) {
    if (
      !/^\d{6}$/.test(endMonth) ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 12
    ) {
      throw new Error("조회 기간 형식이 올바르지 않습니다.");
    }

    const year = Number(endMonth.slice(0, 4));
    const month = Number(endMonth.slice(4, 6));

    if (year < 2006 || month < 1 || month > 12) {
      throw new Error("조회할 연도와 월을 확인해 주세요.");
    }

    const months = [];

    for (let offset = count - 1; offset >= 0; offset--) {
      const date = new Date(Date.UTC(year, month - 1 - offset, 1));
      const value = date.toISOString().slice(0, 7).replace("-", "");

      if (Number(value.slice(0, 4)) < 2006) {
        throw new Error("2006년 이전이 포함되는 기간은 조회할 수 없습니다.");
      }

      months.push(value);
    }

    return months;
  }

  // 여러 달을 순서대로 조회
  async function fetchPeriod(
    serviceKey,
    regionCode,
    endMonth,
    count = 12,
    onProgress = function () {}
  ) {
    const months = getMonths(endMonth, count);
    const trades = [];

    for (let index = 0; index < months.length; index++) {
      const month = months[index];

      onProgress({
        month: month,
        completed: index,
        total: months.length
      });

      let monthlyTrades;

      try {
        monthlyTrades = await fetchMonth(
          serviceKey,
          regionCode,
          month
        );
      } catch (error) {
        // 일부 월만 성공한 결과를 전체 기간처럼 사용하지 않음
        throw new Error(month + " 조회 실패: " + error.message);
      }

      monthlyTrades.forEach(function (trade) {
        trades.push(trade);
      });

      onProgress({
        month: month,
        completed: index + 1,
        total: months.length
      });
    }

    return {
      months: months,
      trades: trades
    };
  }

  // 같은 단지·주소·전용면적별로 거래 묶기
  function groupApartments(trades) {
    const groups = new Map();

    trades.forEach(function (trade) {
      const id = JSON.stringify([
        trade.regionCode,
        trade.neighborhood,
        trade.addressNumber,
        trade.name,
        trade.area
      ]);

      if (!groups.has(id)) {
        groups.set(id, {
          id: id,
          name: trade.name,
          neighborhood: trade.neighborhood,
          area: trade.area,
          label:
            trade.name +
            " · " + trade.neighborhood +
            " · " + trade.area + "㎡",
          trades: []
        });
      }

      groups.get(id).trades.push({
        date: trade.date,
        price: trade.price,
        floor: trade.floor
      });
    });

    return Array.from(groups.values()).sort(function (a, b) {
      return a.label.localeCompare(b.label, "ko");
    });
  }

  return {
    fetchMonth: fetchMonth,
    fetchPeriod: fetchPeriod,
    getMonths: getMonths,
    groupApartments: groupApartments
  };
})();