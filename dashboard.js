(function () {
  "use strict";

  const source = window.TAVRIDA_DASHBOARD_DATA;
  if (!source) {
    document.body.innerHTML = "<main class=\"empty-state\">Не удалось загрузить данные дашборда.</main>";
    return;
  }

  const records = source.records;
  const dictionary = source.dictionary;
  const trajectoryMap = new Map(dictionary.trajectories.map((item) => [item.id, item]));

  const state = {
    program: "all",
    direction: "all",
    region: "all",
    level: "all",
    trajectory: "all",
    year: "all",
    attribution: "all",
    evidence: "all",
    search: "",
    caseLimit: 12,
  };

  const attributionLabels = [
    {
      id: "full",
      label: "Полностью связан — без «Тавриды» этого не произошло бы",
      color: "#18ad3c",
    },
    {
      id: "strong",
      label: "В значительной степени связан — «Таврида» стала ключевым толчком",
      color: "#18ad3c",
    },
    {
      id: "partial",
      label: "Частично связан — был один из нескольких факторов",
      color: "#18ad3c",
    },
    {
      id: "weak",
      label: "Скорее не связан — успех определили другие обстоятельства",
      color: "#18ad3c",
    },
    {
      id: "none",
      label: "Не связан совсем",
      color: "#18ad3c",
    },
  ];

  const timeOrder = [
    "До 3 месяцев включительно",
    "4–6 месяцев",
    "7–12 месяцев",
    "1–2 года",
    "Более 2 лет",
    "Пока не могу выделить отдельный заметный результат",
  ];

  const colors = ["#0f766e", "#2e69c9", "#d99416", "#d94b45", "#7755b8", "#2f8f56"];

  const $ = (selector) => document.querySelector(selector);
  const numberFormat = new Intl.NumberFormat("ru-RU");
  const decimalFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const percentFormat = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
      const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
      return map[char];
    });
  }

  function percent(part, total) {
    if (!total) return "0%";
    return percentFormat.format(part / total);
  }

  function precisePercent(part, total) {
    if (!total) return "0,00%";
    return `${decimalFormat.format((part / total) * 100)}%`;
  }

  function average(values) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (!valid.length) return null;
    return valid.reduce((sum, value) => sum + value, 0) / valid.length;
  }

  function counter(items) {
    const map = new Map();
    items.forEach((item) => {
      if (!item) return;
      map.set(item, (map.get(item) || 0) + 1);
    });
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  }

  function multiCounter(list, getter) {
    const map = new Map();
    list.forEach((record) => {
      getter(record).forEach((item) => {
        if (!item) return;
        map.set(item, (map.get(item) || 0) + 1);
      });
    });
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));
  }

  function compactLabel(label, size = 82) {
    if (!label) return "";
    return label.length > size ? `${label.slice(0, size - 1).trim()}…` : label;
  }

  function hasSearch(record) {
    if (!state.search) return true;
    const haystack = [
      record.id,
      record.displayName,
      record.region,
      record.professionalLevel,
      record.primaryActivity,
      record.additionalActivity,
      record.caseSummary,
      record.skillsSummary,
      record.futureLink,
      record.missingSummary,
      record.directions.join(" "),
      record.programs.join(" "),
      record.trajectories.map((tag) => trajectoryMap.get(tag)?.label || tag).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(state.search.toLowerCase());
  }

  function matchesFilters(record) {
    if (state.program !== "all" && !record.programs.includes(state.program)) return false;
    if (state.direction !== "all" && !record.directions.includes(state.direction)) return false;
    if (state.region !== "all" && record.region !== state.region) return false;
    if (state.level !== "all" && record.professionalLevel !== state.level) return false;
    if (state.trajectory !== "all" && !record.trajectories.includes(state.trajectory)) return false;
    if (state.year !== "all" && !record.programYears.includes(Number(state.year))) return false;
    if (state.attribution === "positive" && !record.positiveAttribution) return false;
    if (state.attribution === "strong" && !record.strongAttribution) return false;
    if (state.attribution === "weak" && record.positiveAttribution) return false;
    if (state.evidence === "with-evidence" && record.evidenceCount === 0) return false;
    if (state.evidence === "with-interview" && record.interviewConsent !== "Да") return false;
    if (state.evidence === "public-materials" && !record.materialsAllowed) return false;
    return hasSearch(record);
  }

  function filteredRecords() {
    return records.filter(matchesFilters);
  }

  function kpiCard(title, value, subtext, tone = "teal") {
    return `
      <article class="kpi-card" data-tone="${tone}">
        <h3>${escapeHtml(title)}</h3>
        <div class="kpi-value">${escapeHtml(value)}</div>
        <p class="kpi-sub">${escapeHtml(subtext)}</p>
      </article>
    `;
  }

  function barRow(item, total, options = {}) {
    const max = options.max ?? total;
    const width = max ? Math.max(2, Math.min(100, (item.count / max) * 100)) : 0;
    const color = options.color || item.color || colors[0];
    const valueLabel = item.valueLabel || `${numberFormat.format(item.count)} · ${percent(item.count, total)}`;
    const meta = item.meta ? `<div class="impact-meta">${escapeHtml(item.meta)}</div>` : "";
    return `
      <div class="bar-row">
        <div class="row-top">
          <span class="row-label">${escapeHtml(compactLabel(item.label, options.labelSize || 92))}</span>
          <span class="row-value">${escapeHtml(valueLabel)}</span>
        </div>
        <div class="track" aria-hidden="true">
          <div class="fill" style="--width:${width}%; --bar-color:${color};"></div>
        </div>
        ${meta}
      </div>
    `;
  }

  function renderBarList(container, items, total, options = {}) {
    const max = options.scaleToMax ? Math.max(...items.map((item) => item.count), 1) : total;
    container.innerHTML = items.length
      ? items.map((item, index) => barRow({ ...item, color: item.color || colors[index % colors.length] }, total, { ...options, max })).join("")
      : "<div class=\"empty-state\">Нет данных для выбранного фильтра.</div>";
  }

  function renderKpis(list) {
    const total = list.length;
    const positive = list.filter((record) => record.positiveAttribution);
    const strong = list.filter((record) => record.strongAttribution);
    const timeBase = positive.filter((record) => record.timeToResult);
    const withinSix = timeBase.filter((record) =>
      ["До 3 месяцев включительно", "4–6 месяцев"].includes(record.timeToResult),
    );
    const impactAverage = average(list.map((record) => record.impactIndex).filter((value) => value !== null));
    const scores = list.map((record) => record.recommendation).filter((value) => Number.isFinite(value));
    const promoters = scores.filter((score) => score >= 9).length;
    const detractors = scores.filter((score) => score <= 6).length;
    const nps = scores.length ? Math.round((promoters / scores.length - detractors / scores.length) * 100) : 0;
    const evidence = list.filter((record) => record.evidenceCount > 0).length;
    const interview = list.filter((record) => record.interviewConsent === "Да").length;

    $("#kpiGrid").innerHTML = [
      kpiCard("Участники", numberFormat.format(total), `из ${numberFormat.format(records.length)} ответов в выгрузке`, "blue"),
      kpiCard("Есть связь с программой", percent(positive.length, total), `${positive.length} участников, включая частичную связь`),
      kpiCard("Сильная связь", percent(strong.length, total), `${strong.length} участников видят ключевой вклад`),
      kpiCard("Результат до 6 месяцев", percent(withinSix.length, timeBase.length), `${withinSix.length} из ${timeBase.length || 0} ответов с указанным сроком`, "green"),
      kpiCard("Индекс влияния", impactAverage ? decimalFormat.format(impactAverage) : "0,00", "среднее по десяти аспектам 1–5", "teal"),
      kpiCard("NPS", scores.length ? `${nps > 0 ? "+" : ""}${nps}` : "0", `${promoters} промоутеров, ${detractors} критиков`, "blue"),
      kpiCard("Подтверждения", percent(evidence, total), `${evidence} участников приложили файлы или ссылки`, "amber"),
      kpiCard("Готовы к интервью", percent(interview, total), `${interview} участников можно звать на глубинное интервью`, "green"),
    ].join("");
  }

  function renderAttribution(list) {
    const total = list.length;
    const grouped = new Map(attributionLabels.map((item) => [item.id, 0]));
    list.forEach((record) => grouped.set(record.attributionGroup, (grouped.get(record.attributionGroup) || 0) + 1));
    $("#attributionMeta").textContent =
      `Ответов: ${numberFormat.format(total)} (100%), затруднились ответить: 0 (0%), ` +
      `пропусков: 0 (0%), показов: ${numberFormat.format(total)} (100%).`;
    $("#attributionTable").innerHTML = attributionLabels
      .map((item) => {
        const count = grouped.get(item.id) || 0;
        return `
          <tr>
            <td style="--option-color:${item.color};">${escapeHtml(item.label)}</td>
            <td>${numberFormat.format(count)}</td>
            <td>${precisePercent(count, total)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderSpeed(list) {
    const base = list.filter((record) => record.timeToResult);
    const counts = new Map(counter(base.map((record) => record.timeToResult)).map((item) => [item.label, item.count]));
    const items = timeOrder
      .filter((label) => counts.has(label))
      .map((label, index) => ({ label, count: counts.get(label), color: colors[index % colors.length] }));
    renderBarList($("#speedBars"), items, base.length, { labelSize: 70 });
  }

  function impactStats(list) {
    return dictionary.impactLabels
      .map((label, index) => {
        const values = list.map((record) => record.impact[index]).filter((value) => Number.isFinite(value));
        const avg = average(values);
        const top = values.filter((value) => value >= 4).length;
        const low = values.filter((value) => value <= 2).length;
        const difficult = list.filter((record) => record.impact[index] === null).length;
        return {
          label,
          avg,
          count: values.length,
          top,
          low,
          difficult,
        };
      })
      .sort((a, b) => (b.avg || 0) - (a.avg || 0));
  }

  function renderImpact(list) {
    const stats = impactStats(list);
    $("#impactBars").innerHTML = stats.length
      ? stats
          .map((item) => {
            const width = item.avg ? Math.max(2, (item.avg / 5) * 100) : 0;
            return `
              <div class="impact-row">
                <div>
                  <div class="impact-label">${escapeHtml(item.label)}</div>
                  <div class="impact-meta">${escapeHtml(`${item.count} оценок, ${item.difficult} затруднились`)}</div>
                </div>
                <div class="track" aria-hidden="true">
                  <div class="fill" style="--width:${width}%; --bar-color:#0f766e;"></div>
                </div>
                <div class="score-pill">${item.avg ? decimalFormat.format(item.avg) : "0,00"}</div>
              </div>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">Нет оценок для выбранного сегмента.</div>";
  }

  function renderTrajectories(list) {
    const total = list.length;
    const counts = new Map();
    list.forEach((record) => {
      record.trajectories.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
    });

    const items = dictionary.trajectories
      .map((trajectory) => ({ ...trajectory, count: counts.get(trajectory.id) || 0 }))
      .filter((trajectory) => trajectory.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"));

    $("#trajectoryGrid").innerHTML = items.length
      ? items
          .map((item, index) => {
            const width = total ? Math.max(4, (item.count / total) * 100) : 0;
            const active = state.trajectory === item.id ? " is-active" : "";
            return `
              <button class="trajectory-card${active}" type="button" data-trajectory="${escapeHtml(item.id)}">
                <span class="trajectory-title">
                  <h3>${escapeHtml(item.label)}</h3>
                  <span class="trajectory-count">${numberFormat.format(item.count)}</span>
                </span>
                <p>${escapeHtml(item.description)}</p>
                <span class="trajectory-share">${escapeHtml(percent(item.count, total))} выбранного сегмента</span>
                <span class="track" aria-hidden="true">
                  <span class="fill" style="--width:${width}%; --bar-color:${colors[index % colors.length]};"></span>
                </span>
              </button>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">В этом сегменте траектории не определены.</div>";

    document.querySelectorAll("[data-trajectory]").forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.getAttribute("data-trajectory");
        state.trajectory = state.trajectory === value ? "all" : value;
        $("#trajectoryFilter").value = state.trajectory;
        state.caseLimit = 12;
        render();
      });
    });
  }

  function renderFactorPanels(list) {
    const factorItems = dictionary.factors.map((label) => ({
      label,
      count: list.filter((record) => record.factors.includes(label)).length,
    }));
    renderBarList(
      $("#factorBars"),
      factorItems.filter((item) => item.count > 0).sort((a, b) => b.count - a.count).slice(0, 8),
      list.length,
      { scaleToMax: true, labelSize: 72 },
    );

    const supportItems = dictionary.supportNeeds.map((label) => ({
      label,
      count: list.filter((record) => record.supportNeeds.includes(label)).length,
    }));
    renderBarList(
      $("#supportBars"),
      supportItems.filter((item) => item.count > 0).sort((a, b) => b.count - a.count),
      list.length,
      { scaleToMax: true, labelSize: 72 },
    );
  }

  function renderSegments(list) {
    renderBarList($("#segmentPrograms"), multiCounter(list, (record) => record.programs), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentDirections"), multiCounter(list, (record) => record.directions).slice(0, 10), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentRegions"), counter(list.map((record) => record.region)).slice(0, 10), list.length, {
      scaleToMax: true,
      labelSize: 54,
    });
    renderBarList($("#segmentLevels"), counter(list.map((record) => record.professionalLevel)), list.length, {
      scaleToMax: true,
      labelSize: 46,
    });
    renderBarList($("#segmentYears"), counter(list.map((record) => record.latestYear || "Не указан")).slice(0, 6), list.length, {
      scaleToMax: true,
      labelSize: 34,
    });
  }

  function permissionText(record) {
    if (record.nameAllowed && record.materialsAllowed) return "Можно имя и материалы";
    if (record.nameAllowed) return "Можно имя без материалов";
    if (record.anonymousOnly) return "Только обезличенно";
    return "Внутренний кейс";
  }

  function caseMatches(record) {
    return record.caseAllowed && (record.caseSummary || record.skillsSummary || record.futureLink);
  }

  function renderCases(list) {
    const cases = list
      .filter(caseMatches)
      .sort((a, b) => b.qualityScore - a.qualityScore || (b.impactIndex || 0) - (a.impactIndex || 0));
    const visible = cases.slice(0, state.caseLimit);

    $("#casesMeta").textContent = `${numberFormat.format(cases.length)} кейсов в выбранном сегменте, показано ${numberFormat.format(visible.length)}.`;
    $("#showMoreCases").style.display = visible.length < cases.length ? "inline-flex" : "none";

    $("#caseGrid").innerHTML = visible.length
      ? visible
          .map((record) => {
            const trajectory = trajectoryMap.get(record.primaryTrajectory)?.label || "Кейс";
            const impact = record.impactIndex ? decimalFormat.format(record.impactIndex) : "н/д";
            const evidenceLabel =
              record.evidenceCount > 0 ? `${record.evidenceCount} подтвержд.` : "без файла";
            return `
              <article class="case-card">
                <header>
                  <div>
                    <p class="eyebrow">${escapeHtml(trajectory)}</p>
                    <h3>${escapeHtml(record.displayName || record.id)}</h3>
                  </div>
                  <span class="case-score">${escapeHtml(impact)}</span>
                </header>
                <p class="case-text">${escapeHtml(record.caseSummary || record.skillsSummary || record.futureLink)}</p>
                <div class="case-meta" aria-label="Параметры кейса">
                  <span>${escapeHtml(record.region || "Регион не указан")}</span>
                  <span>${escapeHtml(record.latestYear || "год не указан")}</span>
                  <span>${escapeHtml(compactLabel(record.programs.join(", "), 48) || "программа не указана")}</span>
                  <span>${escapeHtml(compactLabel(record.directions.join(", "), 48) || "направление не указано")}</span>
                </div>
                <div class="case-flags">
                  <span class="${record.evidenceCount > 0 ? "good" : "warn"}">${escapeHtml(evidenceLabel)}</span>
                  <span class="${record.interviewConsent === "Да" ? "good" : "warn"}">${escapeHtml(record.interviewConsent === "Да" ? "готов к интервью" : "интервью не подтверждено")}</span>
                </div>
                <div class="case-permission">
                  <span class="${record.materialsAllowed ? "good" : "warn"}">${escapeHtml(permissionText(record))}</span>
                  <span>${escapeHtml(record.timeToResult || "срок не указан")}</span>
                </div>
              </article>
            `;
          })
          .join("")
      : "<div class=\"empty-state\">Кейсы для выбранного сегмента не найдены.</div>";
  }

  function renderInsight(list) {
    if (!list.length) {
      $("#segmentInsight").textContent = "Для выбранных фильтров нет ответов. Сбросьте часть условий, чтобы увидеть картину.";
      return;
    }
    const stats = impactStats(list).filter((item) => item.avg !== null);
    const topImpact = stats[0];
    const lowImpact = stats[stats.length - 1];
    const trajectories = multiCounter(list, (record) =>
      record.trajectories.map((tag) => trajectoryMap.get(tag)?.label || tag),
    );
    const topTrajectory = trajectories[0];
    const strong = list.filter((record) => record.strongAttribution).length;
    const evidence = list.filter((record) => record.evidenceCount > 0).length;
    const text = [
      `В выбранной группе ${numberFormat.format(list.length)} участников.`,
      `Сильную или полную связь с программой видят ${percent(strong, list.length)}.`,
      topImpact
        ? `Самый сильный аспект влияния: ${topImpact.label.toLowerCase()} (${decimalFormat.format(topImpact.avg)} из 5).`
        : "",
      lowImpact
        ? `Самая осторожная зона: ${lowImpact.label.toLowerCase()} (${decimalFormat.format(lowImpact.avg)} из 5).`
        : "",
      topTrajectory
        ? `Главная траектория по открытым ответам: ${topTrajectory.label.toLowerCase()}.`
        : "",
      `${numberFormat.format(evidence)} кейсов имеют подтверждающие материалы или внешние ссылки.`,
    ].filter(Boolean);
    $("#segmentInsight").textContent = text.join(" ");
  }

  function renderStatus(list) {
    const active = [];
    if (state.program !== "all") active.push(`программа: ${state.program}`);
    if (state.direction !== "all") active.push(`направление: ${state.direction}`);
    if (state.region !== "all") active.push(`регион: ${state.region}`);
    if (state.level !== "all") active.push("уровень выбран");
    if (state.trajectory !== "all") active.push(`траектория: ${trajectoryMap.get(state.trajectory)?.label || state.trajectory}`);
    if (state.year !== "all") active.push(`год: ${state.year}`);
    if (state.attribution !== "all") active.push("фильтр влияния");
    if (state.evidence !== "all") active.push("фильтр подтверждений");
    if (state.search) active.push(`поиск: ${state.search}`);
    $("#filterStatus").textContent = active.length
      ? `${numberFormat.format(list.length)} ответов после фильтрации: ${active.join("; ")}.`
      : `${numberFormat.format(list.length)} ответов, фильтры не применены.`;
  }

  function render() {
    const list = filteredRecords();
    renderStatus(list);
    renderKpis(list);
    renderAttribution(list);
    renderSpeed(list);
    renderInsight(list);
    renderImpact(list);
    renderTrajectories(list);
    renderFactorPanels(list);
    renderCases(list);
    renderSegments(list);
  }

  function fillSelect(id, values, label) {
    const select = $(id);
    select.innerHTML = `<option value="all">${escapeHtml(label)}</option>`;
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
  }

  function setupFilters() {
    fillSelect("#programFilter", dictionary.programs, "Все программы");
    fillSelect("#directionFilter", dictionary.directions, "Все направления");
    fillSelect("#regionFilter", counter(records.map((record) => record.region)).map((item) => item.label), "Все регионы");
    fillSelect("#levelFilter", counter(records.map((record) => record.professionalLevel)).map((item) => item.label), "Все уровни");
    fillSelect(
      "#trajectoryFilter",
      dictionary.trajectories.map((item) => item.label),
      "Все траектории",
    );
    const trajectorySelect = $("#trajectoryFilter");
    [...trajectorySelect.options].forEach((option) => {
      if (option.value === "all") return;
      const match = dictionary.trajectories.find((item) => item.label === option.value);
      if (match) option.value = match.id;
    });
    const years = [...new Set(records.flatMap((record) => record.programYears))]
      .filter(Boolean)
      .sort((a, b) => b - a)
      .map(String);
    fillSelect("#yearFilter", years, "Все годы");

    [
      ["programFilter", "program"],
      ["directionFilter", "direction"],
      ["regionFilter", "region"],
      ["levelFilter", "level"],
      ["trajectoryFilter", "trajectory"],
      ["yearFilter", "year"],
      ["attributionFilter", "attribution"],
      ["evidenceFilter", "evidence"],
    ].forEach(([id, key]) => {
      $(`#${id}`).addEventListener("change", (event) => {
        state[key] = event.target.value;
        state.caseLimit = 12;
        render();
      });
    });

    $("#caseSearch").addEventListener("input", (event) => {
      state.search = event.target.value.trim();
      state.caseLimit = 12;
      render();
    });

    $("#resetFilters").addEventListener("click", () => {
      Object.assign(state, {
        program: "all",
        direction: "all",
        region: "all",
        level: "all",
        trajectory: "all",
        year: "all",
        attribution: "all",
        evidence: "all",
        search: "",
        caseLimit: 12,
      });
      $("#filters").reset();
      $("#caseSearch").value = "";
      render();
    });

    $("#showMoreCases").addEventListener("click", () => {
      state.caseLimit += 12;
      render();
    });

  }

  function setupStaticText() {
    $("#responseBadge").textContent = `${source.meta.responses} ответ`;
    $("#periodBadge").textContent = `${source.meta.responsePeriod.from} — ${source.meta.responsePeriod.to}`;
  }

  setupStaticText();
  setupFilters();
  render();
})();
