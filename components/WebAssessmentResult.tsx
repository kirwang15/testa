"use client";

import Link from "next/link";
import { AlertTriangle, Download, Home, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import {
  loadAssessmentState,
  saveAssessmentState,
  type AssessmentSession
} from "@/lib/web-assessment";
import { useI18n } from "@/lib/use-i18n";
import { useAssessmentI18n } from "@/lib/assessment-i18n";
import { selectActiveProfile, useGameStore } from "@/store/gameStore";

export function WebAssessmentResult() {
  const { language } = useI18n();
  const t = useAssessmentI18n();
  const profile = useGameStore(selectActiveProfile);
  const [result, setResult] = useState<AssessmentSession>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setResult(loadAssessmentState(profile.id).history[0]);
  }, [profile.id]);

  if (!result) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <Link href="/assessment" className="focus-ring rounded-xl border-2 border-ink bg-sun px-6 py-4 font-black shadow-crisp">
          {t("retest")}
        </Link>
      </main>
    );
  }

  const number = (value: number) =>
    new Intl.NumberFormat(language === "zh-CN" ? "zh-CN" : "en-US").format(value);
  const targetLabel =
    result.selectedAnchor === "unrestricted"
      ? t("lowFrequency")
      : t("target");
  const metrics = [
    { label: t("basic"), value: result.coverage.basic },
    { label: t("advanced"), value: result.coverage.advanced },
    { label: targetLabel, value: result.coverage.target }
  ];
  const invalid = result.reliability === "invalid";

  const retestHref = "/assessment";
  const clearActive = () => {
    const state = loadAssessmentState(profile.id);
    saveAssessmentState(profile.id, { history: state.history });
  };

  const savePoster = () => {
    if (invalid) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#161616";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const gradient = context.createRadialGradient(900, 120, 20, 900, 120, 700);
    gradient.addColorStop(0, "rgba(255,200,87,0.38)");
    gradient.addColorStop(1, "rgba(255,200,87,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffc857";
    context.font = "900 36px Georgia, serif";
    context.fillText(t("beta"), 84, 110);
    context.fillStyle = "#ffffff";
    context.font = "900 94px Georgia, serif";
    context.fillText(t("estimate", { estimate: number(result.estimate) }), 84, 260);
    context.fillStyle = "rgba(255,255,255,0.72)";
    context.font = "700 34px Georgia, serif";
    context.fillText(
      t("range", {
        lower: number(result.estimateLower),
        upper: number(result.estimateUpper)
      }),
      84,
      330
    );
    context.fillText(t(`anchor.${result.selectedAnchor}`), 84, 390);
    metrics.forEach((metric, index) => {
      const y = 520 + index * 150;
      context.fillStyle = "#ffffff";
      context.font = "700 32px Georgia, serif";
      context.fillText(metric.label, 84, y);
      context.fillStyle = "rgba(255,255,255,0.15)";
      context.fillRect(84, y + 34, 840, 32);
      context.fillStyle = index === 1 ? "#ff6f61" : "#18a999";
      context.fillRect(84, y + 34, 840 * metric.value, 32);
      context.fillStyle = "#ffc857";
      context.fillText(`${Math.round(metric.value * 100)}%`, 934, y + 62);
    });
    context.fillStyle = "#ffc857";
    context.font = "900 42px Georgia, serif";
    wrapText(context, t("posterQuote"), 84, 1080, 900, 60);
    context.fillStyle = "rgba(255,255,255,0.58)";
    context.font = "700 28px Georgia, serif";
    context.fillText(new Date(result.startedAt).toLocaleDateString(), 84, 1320);
    context.fillText("Word Trail · 单词轨迹", 684, 1320);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `word-trail-vocabulary-${result.startedAt.slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
      setSaved(true);
    }, "image/png");
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className={`rounded-2xl border-2 border-ink p-6 shadow-crisp sm:p-8 ${invalid ? "bg-red-50" : "bg-ink text-white"}`}>
          <p className={`text-xs font-black uppercase tracking-[0.15em] ${invalid ? "text-coral" : "text-sun"}`}>
            {t("resultTitle")}
          </p>
          <h1 className={`mt-3 text-3xl font-black sm:text-5xl ${invalid ? "text-ink" : "text-white"}`}>
            {t("rangeHeadline", {
              lower: number(result.estimateLower),
              upper: number(result.estimateUpper)
            })}
          </h1>
          <p className={`mt-3 text-lg font-bold ${invalid ? "text-ink/65" : "text-white/70"}`}>
            {t("estimate", { estimate: number(result.estimate) })}
          </p>
          <p className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-black ${
            invalid
              ? "border-red-300 bg-red-100 text-red-800"
              : "border-white/20 bg-white/10 text-sun"
          }`}>
            {invalid ? (
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {t(`reliability.${result.reliability}`)}
          </p>
          {invalid ? (
            <p className="mt-3 font-semibold text-ink/65">{t("invalidBody")}</p>
          ) : null}
        </header>

        {!invalid ? (
          <section className="grid gap-5 rounded-2xl border-2 border-ink bg-white p-5 shadow-crisp sm:grid-cols-[240px_1fr] sm:p-7">
            <CoverageRadar values={metrics.map((metric) => metric.value)} label={`${t("profile")}: ${metrics.map((metric) => `${metric.label} ${Math.round(metric.value * 100)}%`).join("; ")}`} />
            <div>
              <h2 className="text-2xl font-black text-ink">{t("profile")}</h2>
              <div className="mt-5 space-y-4">
                {metrics.map((metric, index) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between gap-3 text-sm font-black text-ink">
                      <span>{metric.label}</span>
                      <span>{Math.round(metric.value * 100)}%</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-paper">
                      <span className={`block h-full ${index === 1 ? "bg-coral" : "bg-mint"}`} style={{ width: `${metric.value * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          {!invalid ? (
            <button type="button" onClick={savePoster} className="focus-ring min-h-14 rounded-xl border-2 border-ink bg-sun px-4 font-black text-ink shadow-crisp">
              <Download className="mr-2 inline h-5 w-5" aria-hidden="true" />
              {saved ? t("posterSaved") : t("savePoster")}
            </button>
          ) : null}
          <Link href={retestHref} onClick={clearActive} className="focus-ring inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-ink bg-paper px-4 font-black text-ink shadow-crisp">
            <RotateCcw className="mr-2 h-5 w-5" aria-hidden="true" />
            {t("retest")}
          </Link>
          <Link href="/" className="focus-ring inline-flex min-h-14 items-center justify-center rounded-xl border-2 border-ink bg-white px-4 font-black text-ink shadow-crisp">
            <Home className="mr-2 h-5 w-5" aria-hidden="true" />
            {t("backHome")}
          </Link>
        </section>
        <p className="text-center text-xs font-bold text-ink/55">{t("note")}</p>
      </div>
    </main>
  );
}

function CoverageRadar({ values, label }: { values: number[]; label: string }) {
  const axes = [
    [100, 20],
    [169, 140],
    [31, 140]
  ];
  const points = axes
    .map(([x, y], index) => `${100 + (x - 100) * values[index]},${100 + (y - 100) * values[index]}`)
    .join(" ");
  return (
    <svg viewBox="0 0 200 180" className="mx-auto w-full max-w-60" role="img" aria-label={label}>
      <polygon points="100,20 169,140 31,140" fill="#f7f8fb" stroke="#161616" strokeWidth="3" />
      <polygon points="100,60 134.5,120 65.5,120" fill="none" stroke="#161616" strokeOpacity="0.2" strokeWidth="2" />
      <line x1="100" y1="100" x2="100" y2="20" stroke="#161616" strokeOpacity="0.2" />
      <line x1="100" y1="100" x2="169" y2="140" stroke="#161616" strokeOpacity="0.2" />
      <line x1="100" y1="100" x2="31" y2="140" stroke="#161616" strokeOpacity="0.2" />
      <polygon points={points} fill="#18a999" fillOpacity="0.45" stroke="#161616" strokeWidth="3" />
    </svg>
  );
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const characters = [...text];
  let line = "";
  let lineY = y;
  for (const character of characters) {
    const next = line + character;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, lineY);
      line = character;
      lineY += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) context.fillText(line, x, lineY);
}
