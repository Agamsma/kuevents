"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Loader2,
  PartyPopper,
  Trash2,
} from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { uploadEventCover, UploadError } from "@/lib/storage";
import { formatDateTime } from "@/lib/format";
import {
  EVENT_CATEGORIES,
  TRACK_FULL_NAMES,
  TRACK_LABELS,
  type EventCategory,
  type EventTrack,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ChipGroup, TextAreaField, TextField } from "@/components/ui/field";
import { FieldLabel, Perforation, Stub } from "@/components/ui/stub";
import { toast } from "@/components/ui/toast";

interface Draft {
  title: string;
  description: string;
  track: EventTrack | null;
  category: EventCategory | null;
  starts_at: string;
  duration_hours: string;
  venue: string;
  expected_footfall: string;
  cover_file: File | null;
  cover_preview: string | null;
}

const EMPTY: Draft = {
  title: "",
  description: "",
  track: null,
  category: null,
  starts_at: "",
  duration_hours: "3",
  venue: "",
  expected_footfall: "50",
  cover_file: null,
  cover_preview: null,
};

const STEPS = [
  { id: 0, label: "The idea" },
  { id: 1, label: "When & where" },
  { id: 2, label: "Look" },
  { id: 3, label: "Review" },
] as const;

type Errors = Partial<Record<keyof Draft, string>>;

/**
 * Validates one step at a time.
 *
 * Split per step rather than validating everything at the end so that a person
 * is never bounced backwards past work they thought was done — you find out a
 * field is wrong while you are still looking at it.
 */
function validateStep(step: number, draft: Draft): Errors {
  const errors: Errors = {};

  if (step === 0) {
    if (draft.title.trim().length < 3) {
      errors.title = "Give it a name people would recognise.";
    }
    if (!draft.track) errors.track = "Pick who is running it.";
    if (!draft.category) errors.category = "Pick a category.";
  }

  if (step === 1) {
    if (!draft.starts_at) {
      errors.starts_at = "Pick a date and time.";
    } else if (new Date(draft.starts_at).getTime() < Date.now()) {
      errors.starts_at = "Pick a date in the future.";
    }

    if (!draft.venue.trim()) errors.venue = "Where should this happen?";

    const footfall = Number(draft.expected_footfall);
    if (!Number.isFinite(footfall) || footfall < 1) {
      errors.expected_footfall = "Roughly how many people do you expect?";
    }

    const hours = Number(draft.duration_hours);
    if (!Number.isFinite(hours) || hours < 1) {
      errors.duration_hours = "At least an hour.";
    }
  }

  return errors;
}

export function ProposalForm() {
  const { user, profile, getIdToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }, []);

  const startsAtMs = useMemo(
    () => (draft.starts_at ? new Date(draft.starts_at).getTime() : 0),
    [draft.starts_at],
  );

  const next = useCallback(() => {
    const found = validateStep(step, draft);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, draft]);

  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const pickCover = useCallback(
    (file: File | null) => {
      if (!file) return;

      // Revoke the previous object URL before replacing it, or every re-pick
      // leaks a blob for the lifetime of the page.
      setDraft((current) => {
        if (current.cover_preview) URL.revokeObjectURL(current.cover_preview);
        return {
          ...current,
          cover_file: file,
          cover_preview: URL.createObjectURL(file),
        };
      });
    },
    [],
  );

  const clearCover = useCallback(() => {
    setDraft((current) => {
      if (current.cover_preview) URL.revokeObjectURL(current.cover_preview);
      return { ...current, cover_file: null, cover_preview: null };
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const submit = useCallback(async () => {
    if (!user) return;

    // Re-run every step's validation, not just the current one — someone can
    // reach review, go back, empty a field, and come forward again.
    for (const s of [0, 1]) {
      const found = validateStep(s, draft);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(s);
        toast.error("Something is missing", {
          id: "propose",
          description: Object.values(found)[0],
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      let coverUrl: string | null = null;

      if (draft.cover_file) {
        setUploadPct(0);
        coverUrl = await uploadEventCover({
          file: draft.cover_file,
          uid: user.uid,
          onProgress: setUploadPct,
        });
      }

      const token = await getIdToken();
      if (!token) throw new Error("Your session expired. Sign in again.");

      const durationMs = Number(draft.duration_hours) * 60 * 60 * 1000;

      const response = await fetch("/api/events/propose", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          venue: draft.venue,
          starts_at: startsAtMs,
          ends_at: startsAtMs + durationMs,
          track: draft.track,
          category: draft.category,
          expected_footfall: Number(draft.expected_footfall),
          capacity: 0,
          cover_image_url: coverUrl,
        }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not send the proposal.");

      setDone(true);
    } catch (error) {
      const message =
        error instanceof UploadError || error instanceof Error
          ? error.message
          : "Something went wrong.";
      toast.error("Could not send your proposal", {
        id: "propose",
        description: message,
      });
    } finally {
      setSubmitting(false);
      setUploadPct(null);
    }
  }, [user, draft, startsAtMs, getIdToken]);

  if (done) return <SuccessPanel onAnother={() => router.push("/")} />;

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-28 sm:px-6">
      <Link
        href="/"
        className="mb-7 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-faint transition-colors hover:text-bone"
      >
        <ArrowLeft className="size-3" />
        Back to events
      </Link>

      <FieldLabel>Propose an event</FieldLabel>
      <h1 className="display mt-3 text-[clamp(2rem,6vw,2.75rem)] text-bone">
        Tell us what you want to run
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-bone-dim">
        An organizer reviews every proposal. If it is approved it goes straight
        onto the campus directory and students can reserve passes.
      </p>

      <StepRail current={step} />

      <Stub className="mt-7 overflow-hidden">
        <div className="px-6 py-7 sm:px-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === 0 ? (
                <div className="space-y-6">
                  <TextField
                    label="Event title"
                    name="title"
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
                    error={errors.title}
                    placeholder="Midnight Hackathon 2026"
                    maxLength={120}
                    autoFocus
                  />

                  <ChipGroup
                    label="Who is running it"
                    name="track"
                    value={draft.track}
                    onChange={(v) => set("track", v)}
                    error={errors.track}
                    options={(Object.keys(TRACK_LABELS) as EventTrack[]).map((t) => ({
                      value: t,
                      label: TRACK_LABELS[t],
                      hint: TRACK_FULL_NAMES[t],
                    }))}
                  />

                  <ChipGroup
                    label="Category"
                    name="category"
                    value={draft.category}
                    onChange={(v) => set("category", v)}
                    error={errors.category}
                    options={EVENT_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  />

                  <TextAreaField
                    label="What happens"
                    name="description"
                    value={draft.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="A 24-hour build sprint open to all years. Teams of four, mentors on site, judging at noon."
                    maxLength={2000}
                    hint={`${draft.description.length}/2000`}
                  />
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-6">
                  <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
                    <TextField
                      label="Starts"
                      name="starts_at"
                      type="datetime-local"
                      value={draft.starts_at}
                      onChange={(e) => set("starts_at", e.target.value)}
                      error={errors.starts_at}
                    />
                    <TextField
                      label="Hours"
                      name="duration_hours"
                      type="number"
                      min="1"
                      max="72"
                      value={draft.duration_hours}
                      onChange={(e) => set("duration_hours", e.target.value)}
                      error={errors.duration_hours}
                    />
                  </div>

                  <TextField
                    label="Requested venue"
                    name="venue"
                    value={draft.venue}
                    onChange={(e) => set("venue", e.target.value)}
                    error={errors.venue}
                    placeholder="Main Auditorium, UnitedWorld Campus"
                    hint="Organizers confirm availability before approving."
                  />

                  <TextField
                    label="Expected footfall"
                    name="expected_footfall"
                    type="number"
                    min="1"
                    value={draft.expected_footfall}
                    onChange={(e) => set("expected_footfall", e.target.value)}
                    error={errors.expected_footfall}
                    hint="Your best guess. The organizer sets the final capacity."
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <CoverStep
                  preview={draft.cover_preview}
                  onPick={pickCover}
                  onClear={clearCover}
                  inputRef={fileInputRef}
                />
              ) : null}

              {step === 3 ? (
                <ReviewStep
                  draft={draft}
                  startsAtMs={startsAtMs}
                  proposer={profile?.full_name ?? user?.email ?? ""}
                  onEdit={setStep}
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <Perforation className="mx-6" />

        <div className="flex items-center justify-between gap-3 px-6 py-5 sm:px-8">
          <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
            <ArrowLeft className="size-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={next}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button variant="gold" onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {uploadPct !== null ? `Uploading ${uploadPct}%` : "Sending"}
                </>
              ) : (
                <>
                  Send for review
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </Stub>
    </div>
  );
}

/** The progress rail. Completed steps stay filled so progress reads at a glance. */
function StepRail({ current }: { current: number }) {
  return (
    <ol className="mt-9 flex items-center gap-2">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2">
          <div className="flex-1">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.07]">
              <motion.div
                initial={false}
                animate={{ width: i <= current ? "100%" : "0%" }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-crimson"
              />
            </div>
            <div
              className={`mt-2 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors ${
                i <= current ? "text-bone-dim" : "text-bone-faint"
              }`}
            >
              {s.label}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function CoverStep({
  preview,
  onPick,
  onClear,
  inputRef,
}: {
  preview: string | null;
  onPick: (file: File | null) => void;
  onClear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <FieldLabel>Cover image</FieldLabel>
      <p className="mt-2 text-[13px] leading-relaxed text-bone-dim">
        Optional, but events with a cover get noticed. Landscape works best.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-2xl border border-line">
          {/* A blob: URL cannot go through the Next image optimiser, so this one
              stays a plain <img>. The uploaded version renders via next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Cover preview" className="size-full object-cover" />

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone">
              Preview
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
                Replace
              </Button>
              <Button size="sm" variant="ghost" onClick={onClear}>
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onPick(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`mt-5 flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed transition-colors ${
            dragging
              ? "border-crimson bg-crimson/[0.06]"
              : "border-[color:var(--line-strong)] hover:border-crimson/50 hover:bg-white/[0.03]"
          }`}
        >
          <ImagePlus className="size-7 text-bone-faint" />
          <div className="text-center">
            <div className="text-sm font-medium text-bone">
              Drop an image, or choose a file
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-faint">
              JPG · PNG · WebP · up to 5 MB
            </div>
          </div>
        </button>
      )}
    </div>
  );
}

function ReviewStep({
  draft,
  startsAtMs,
  proposer,
  onEdit,
}: {
  draft: Draft;
  startsAtMs: number;
  proposer: string;
  onEdit: (step: number) => void;
}) {
  const rows: [string, string, number][] = [
    ["Title", draft.title || "—", 0],
    ["Running it", draft.track ? TRACK_LABELS[draft.track] : "—", 0],
    ["Category", draft.category ?? "—", 0],
    ["Starts", startsAtMs ? formatDateTime(startsAtMs) : "—", 1],
    ["Runs for", `${draft.duration_hours} hours`, 1],
    ["Venue", draft.venue || "—", 1],
    ["Expected", `${draft.expected_footfall} people`, 1],
    ["Cover", draft.cover_file ? draft.cover_file.name : "None", 2],
  ];

  return (
    <div>
      <FieldLabel>Check it over</FieldLabel>
      <p className="mt-2 text-[13px] leading-relaxed text-bone-dim">
        This is what the organizer will see. Tap any line to change it.
      </p>

      <dl className="mt-6 divide-y divide-[color:var(--line)]">
        {rows.map(([label, value, targetStep]) => (
          <button
            key={label}
            type="button"
            onClick={() => onEdit(targetStep)}
            className="flex w-full items-baseline justify-between gap-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
          >
            <dt className="field-label shrink-0">{label}</dt>
            <dd className="min-w-0 truncate text-[14px] text-bone">{value}</dd>
          </button>
        ))}
      </dl>

      {draft.description ? (
        <div className="mt-5 rounded-xl border border-line bg-white/[0.02] p-4">
          <FieldLabel>Description</FieldLabel>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-bone-dim">
            {draft.description}
          </p>
        </div>
      ) : null}

      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-faint">
        Proposed by {proposer}
      </p>
    </div>
  );
}

function SuccessPanel({ onAnother }: { onAnother: () => void }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-5 py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full"
      >
        <Stub notched notchAt="calc(100% - 5rem)" className="overflow-hidden text-center">
          <div className="px-8 pb-9 pt-11">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: "spring", stiffness: 260, damping: 18 }}
              className="mx-auto flex size-16 items-center justify-center rounded-full bg-admit/15 ring-1 ring-admit/30"
            >
              <PartyPopper className="size-7 text-admit" />
            </motion.div>

            <h1 className="display mt-7 text-[2rem] text-bone">
              Sent for review
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-bone-dim">
              An organizer will look at it shortly. Once approved, it appears on
              the campus directory and students can reserve passes.
            </p>
          </div>

          <Perforation className="mx-8" />

          <div className="flex h-20 items-center justify-center gap-3 px-8">
            <Button variant="outline" onClick={onAnother}>
              Back to events
            </Button>
            <Button asChild>
              <Link href="/events/request">
                <Check className="size-4" />
                Propose another
              </Link>
            </Button>
          </div>
        </Stub>
      </motion.div>
    </div>
  );
}
