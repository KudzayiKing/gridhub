"use client";

/**
 * Official AnimateIcons Lucide registry.
 *
 * The package is imported as a namespace and resolved by name at runtime. This is
 * deliberate: it guarantees we only ever render components that actually exist in the
 * installed version of `@animateicons/react/lucide`, and lets us fall back gracefully
 * instead of shipping a broken named import when Lucide renames an icon
 * (e.g. Home → House, LineChart → ChartLine).
 *
 * Every name used by Gridhub is listed in ICON_NAMES below, with alias candidates
 * tried in order. See docs/ANIMATED_ICONS.md for the verification procedure.
 */

import type { ComponentType } from "react";
import * as AnimateLucide from "@animateicons/react/lucide";

type AnyIcon = ComponentType<Record<string, unknown>>;

const catalog = AnimateLucide as unknown as Record<string, AnyIcon | undefined>;

/** Preferred candidate names per logical icon key, most specific first. */
export const ICON_ALIASES: Record<string, string[]> = {
  wallet: ["WalletIcon", "WalletMinimalIcon", "WalletCardsIcon"],
  "calendar-days": ["CalendarDaysIcon", "CalendarIcon"],
  "trending-down": ["TrendingDownIcon", "ChartNoAxesColumnDecreasingIcon"],
  "piggy-bank": ["PiggyBankIcon", "CoinsIcon"],
  "line-chart": ["ChartLineIcon", "LineChartIcon", "ChartSplineIcon"],
  "book-open": ["BookOpenIcon", "NotebookIcon"],
  package: ["PackageIcon", "PackageOpenIcon", "BoxIcon"],
  "shopping-cart": ["ShoppingCartIcon", "ShoppingBagIcon"],
  "file-text": ["FileTextIcon", "FileIcon", "ReceiptTextIcon"],
  waves: ["WavesIcon", "ActivityIcon"],
  heart: ["HeartIcon", "HeartHandshakeIcon"],
  home: ["HouseIcon", "HomeIcon"],
  utensils: ["UtensilsIcon", "UtensilsCrossedIcon", "ChefHatIcon"],
  kanban: ["KanbanIcon", "SquareKanbanIcon", "KanbanSquareIcon", "Columns3Icon"],
  "circle-check": ["CircleCheckIcon", "CheckCircle2Icon", "CircleCheckBigIcon", "CheckIcon"],
  "calendar-range": ["CalendarRangeIcon", "CalendarClockIcon"],

  dashboard: ["LayoutDashboardIcon", "LayoutGridIcon", "Grid2x2Icon"],
  tools: ["WrenchIcon", "BlocksIcon", "Grid2x2Icon"],
  explore: ["CompassIcon", "SearchIcon"],
  billing: ["CreditCardIcon", "ReceiptTextIcon"],
  settings: ["SettingsIcon", "Settings2Icon"],
  search: ["SearchIcon", "ScanSearchIcon"],
  bell: ["BellIcon", "BellRingIcon"],
  plus: ["PlusIcon", "CirclePlusIcon"],
  edit: ["PencilIcon", "SquarePenIcon"],
  trash: ["Trash2Icon", "TrashIcon"],
  save: ["SaveIcon", "CheckIcon"],
  sync: ["RefreshCwIcon", "RefreshCcwIcon", "RotateCwIcon"],
  offline: ["WifiOffIcon", "CloudOffIcon"],
  online: ["WifiIcon", "CloudIcon"],
  download: ["DownloadIcon", "ArrowDownToLineIcon"],
  upload: ["UploadIcon", "ArrowUpFromLineIcon"],
  chevronRight: ["ChevronRightIcon"],
  chevronDown: ["ChevronDownIcon"],
  chevronLeft: ["ChevronLeftIcon"],
  chevronUp: ["ChevronUpIcon"],
  close: ["XIcon", "CircleXIcon"],
  check: ["CheckIcon", "CircleCheckIcon"],
  sun: ["SunIcon", "SunMediumIcon"],
  moon: ["MoonIcon", "MoonStarIcon"],
  monitor: ["MonitorIcon", "LaptopIcon"],
  logout: ["LogOutIcon"],
  user: ["UserIcon", "CircleUserIcon"],
  menu: ["MenuIcon", "PanelLeftIcon"],
  filter: ["FilterIcon", "ListFilterIcon"],
  arrowUp: ["ArrowUpRightIcon", "TrendingUpIcon"],
  arrowDown: ["ArrowDownRightIcon", "TrendingDownIcon"],
  arrowRight: ["ArrowRightIcon"],
  arrowLeft: ["ArrowLeftIcon"],
  lock: ["LockIcon", "LockKeyholeIcon"],
  shield: ["ShieldCheckIcon", "ShieldIcon"],
  alert: ["CircleAlertIcon", "AlertCircleIcon", "TriangleAlertIcon"],
  info: ["InfoIcon"],
  target: ["TargetIcon", "GoalIcon"],
  clock: ["ClockIcon", "TimerIcon"],
  users: ["UsersIcon", "UsersRoundIcon"],
  table: ["TableIcon", "Table2Icon"],
  play: ["PlayIcon"],
  pause: ["PauseIcon"],
  repeat: ["RepeatIcon", "RefreshCwIcon"],
  tag: ["TagIcon", "TagsIcon"],
  // `pin`/`pinOff` drive the pin-to-dashboard control. These must be the real pushpin glyphs —
  // MapPin is a location marker and reads as "drop a pin on a map", not "keep this on my
  // dashboard". Both names were previously missing or mis-aliased, which sent the control
  // through the catch-all fallback and rendered a sparkle.
  pin: ["PinIcon"],
  pinOff: ["PinOffIcon"],
  inbox: ["InboxIcon"],
  lightbulb: ["LightbulbIcon"],
  flask: ["FlaskConicalIcon"],
  blocks: ["BlocksIcon"],
  bank: ["LandmarkIcon", "BuildingIcon"],
  droplet: ["DropletIcon"],
  "chart-column": ["ChartColumnIcon", "ChartColumnBigIcon"],
  "trending-up": ["TrendingUpIcon"],
  wrench: ["WrenchIcon"],
  mail: ["MailIcon"],
  phone: ["PhoneIcon"],
  truck: ["TruckIcon"],
  boxes: ["BoxesIcon", "PackageIcon"],
  receipt: ["ReceiptTextIcon", "ReceiptIcon"],
  gauge: ["GaugeIcon", "ActivityIcon"],
  trendingUp: ["TrendingUpIcon", "ChartNoAxesColumnIncreasingIcon"],
  eye: ["EyeIcon"],
  more: ["EllipsisIcon", "MoreHorizontalIcon"],
  dollar: ["CircleDollarSignIcon", "DollarSignIcon"],
  calendar: ["CalendarIcon"],
  list: ["ListIcon", "Rows3Icon"],
  grid: ["LayoutGridIcon", "Grid2x2Icon"],
  folder: ["FolderIcon", "FolderOpenIcon"],
  camera: ["CameraIcon"],
  coffee: ["CoffeeIcon"],
  cart: ["ShoppingCartIcon"],
  swap: ["ArrowLeftRightIcon", "ArrowRightLeftIcon"],
  link: ["LinkIcon"],
  archive: ["ArchiveIcon"],
  globe: ["GlobeIcon"],
  zap: ["ZapIcon"],
  image: ["ImageIcon"],
  send: ["SendIcon"],
  layers: ["LayersIcon"],
  book: ["BookOpenIcon"],
  briefcase: ["BriefcaseIcon"],
  building: ["Building2Icon", "BuildingIcon"],
  percent: ["PercentIcon"],
  calculator: ["CalculatorIcon"],
  hourglass: ["HourglassIcon"],
  flag: ["FlagIcon"],
  sun2: ["SunriseIcon"],

  /* Gridhub AI — voice and assistant controls. Real animated glyphs, no static substitutes. */
  mic: ["MicIcon"],
  micOff: ["MicOffIcon"],
  stop: ["CircleStopIcon"],
  loader: ["LoaderCircleIcon"],
  /* No `sparkles` key on purpose. The product owner has ruled the sparkle out of the UI, so the
   * key is not registered; the auto-derivation below only tries `${key}Icon` (lower-case first
   * letter), so `name="sparkles"` resolves to nothing rather than the glyph. Pick an icon that
   * says what the thing does: `blocks` for the assistant, `download` for the model install,
   * `shield` for the write-confirmation card. */
  waveform: ["AudioWaveformIcon", "AudioLinesIcon", "ActivityIcon"],
  refresh: ["RotateCcwIcon", "RefreshCwIcon"],
  undo: ["RotateCcwIcon"],
  warning: ["TriangleAlertIcon"],
};

const resolved = new Map<string, AnyIcon>();
const missing = new Set<string>();

/** Resolve a logical icon key to a real AnimateIcons component. */
export function resolveAnimatedIcon(key: string): AnyIcon | null {
  const cached = resolved.get(key);
  if (cached) return cached;

  const candidates = ICON_ALIASES[key] ?? [`${key}Icon`, key];
  for (const name of candidates) {
    const component = catalog[name];
    if (typeof component === "function" || typeof component === "object") {
      resolved.set(key, component as AnyIcon);
      return component as AnyIcon;
    }
  }

  // No catch-all, deliberately. This used to return SparklesIcon, so any unregistered or
  // misspelled key rendered a decorative sparkle instead of the intended glyph — in production,
  // with only a dev-mode console.warn to hint at it. That hid five broken keys at once.
  // Returning null is the honest answer: `AnimatedIcon` already renders an empty, correctly sized
  // span for a null icon, so nothing shifts and the gap is plainly visible. The `missing` set
  // keeps this to one warning per key instead of one per render.
  if (!missing.has(key)) {
    missing.add(key);
    console.error(
      `[gridhub/icons] No animated icon for "${key}". Add it to ICON_ALIASES using a real export name.`,
    );
  }
  return null;
}

/** Diagnostic helper used by the icon acceptance test. */
export function missingIconKeys(keys: string[]): string[] {
  return keys.filter((k) => {
    const candidates = ICON_ALIASES[k] ?? [`${k}Icon`];
    return !candidates.some((name) => Boolean(catalog[name]));
  });
}

export function availableIconCount(): number {
  return Object.keys(catalog).length;
}
