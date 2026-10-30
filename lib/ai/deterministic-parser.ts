/**
 * Gridhub AI — deterministic command router.
 *
 * Navigation, read queries, and common create/update commands are routed without the model.
 * Writes are still validated and shown in the confirmation UI before they are committed.
 */

import { TOOLS, type ToolId } from "@/lib/catalog";
import type { ActionId } from "./action-schemas";
import { normalizeName } from "./entity-resolver";

export interface DeterministicMatch {
  intent: "navigation" | "query" | "action";
  path?: string;
  actionId?: ActionId;
  parameters?: Record<string, unknown>;
}

const NAV_VERB =
  /^(?:please\s+)?(?:open|go\s+to|goto|show\s+me|show|navigate\s+to|take\s+me\s+to|launch|switch\s+to|bring\s+up)\s+(.+)$/;

interface NavTarget {
  path: string;
  aliases: string[];
}

const EXTRA_TARGETS: NavTarget[] = [
  { path: "/app/settings", aliases: ["settings", "account settings", "preferences"] },
  { path: "/app/billing", aliases: ["billing", "subscription", "plan", "upgrade"] },
  { path: "/app/explore", aliases: ["explore", "explore tools", "catalog", "all tools"] },
  { path: "/app/tools", aliases: ["my tools", "tools"] },
  { path: "/app", aliases: ["home", "dashboard", "overview", "workspace"] },
];

const TOOL_TARGETS: NavTarget[] = TOOLS.map((tool) => ({
  path: tool.route,
  aliases: [tool.shortName, tool.name, tool.id, tool.slug, ...tool.keywords].map(normalizeName),
}));

const TARGETS = [...TOOL_TARGETS, ...EXTRA_TARGETS];

// Small, explicit phrase dictionaries turn common localized commands into the same
// conservative English grammar below. User supplied names and amounts are preserved.
const COMMAND_ALIASES: Record<string, Record<string, string>> = {
  es: { "agrega": "add", "añade": "add", "anota": "record", "registra": "record", "recibí": "received", "recibi": "received", "gané": "earned", "gane": "earned", "salario": "salary", "sueldo": "salary", "ingresos": "income", "ingreso": "income", "gastos": "expenses", "gasto": "expense", "para": "for", "a": "to", "de": "of", "en": "in", "ahorré": "save", "ahorre": "save", "ahorrar": "save", "ahorra": "save", "comida": "groceries", "compras": "groceries", "facturas": "bills", "tarea": "task", "tareas": "tasks", "proyecto": "project", "deuda": "debt", "pagué": "paid", "pague": "paid", "meta": "goal", "objetivo": "goal", "activo": "asset", "pasivo": "liability", "inventario": "inventory", "vendí": "sold", "vendi": "sold", "factura": "invoice", "invitado": "guest", "invitados": "guests", "hábito": "habit", "habito": "habit", "publicación": "post", "publicacion": "post", "redacta": "draft", "escribe": "write", "programa": "schedule", "abre": "open", "mostrar": "show", "muéstrame": "show me", "muestrame": "show me", "hoy": "today", "ayer": "yesterday", "mes pasado": "last month", "este mes": "this month", "cuánto gasté": "how much did i spend", "cuanto gaste": "how much did i spend", "cuánto presupuesto me queda": "how much budget do i have left", "cuanto presupuesto me queda": "how much budget do i have left" },
  "zh-CN": { "添加": "add", "记录": "record", "收到": "received", "赚了": "earned", "工资": "salary", "薪水": "salary", "收入": "income", "支出": "expense", "费用": "expense", "用于": "for", "给": "to", "存入": "save", "储蓄": "savings", "买菜": "groceries", "购物": "groceries", "杂货": "groceries", "账单": "bills", "任务": "task", "项目": "project", "债务": "debt", "还款": "paid", "目标": "goal", "资产": "asset", "负债": "liability", "库存": "inventory", "销售": "sale", "发票": "invoice", "客人": "guest", "习惯": "habit", "帖子": "post", "草拟": "draft", "安排": "schedule", "打开": "open", "显示": "show", "今天": "today", "昨天": "yesterday", "为": "for", "上个月": "last month", "这个月": "this month", "我上个月花了多少钱": "how much did i spend last month", "我还剩多少预算": "how much budget do i have left" },
  "pt-BR": { "adicionar": "add", "adicione": "add", "anotar": "record", "anote": "record", "registrar": "record", "registre": "record", "recebi": "received", "receber": "receive", "ganhei": "earned", "salário": "salary", "salario": "salary", "ordenado": "salary", "renda": "income", "receita": "income", "despesa": "expense", "gasto": "expense", "para": "for", "em": "on", "de": "of", "economize": "save", "guardar": "save", "mercado": "groceries", "compras": "groceries", "contas": "bills", "tarefa": "task", "projeto": "project", "dívida": "debt", "divida": "debt", "paguei": "paid", "meta": "goal", "ativo": "asset", "passivo": "liability", "estoque": "inventory", "vendi": "sold", "venda": "sale", "nota fiscal": "invoice", "convidado": "guest", "hábito": "habit", "habito": "habit", "publicação": "post", "publicacao": "post", "rascunho": "draft", "agende": "schedule", "abra": "open", "mostrar": "show", "hoje": "today", "ontem": "yesterday", "mês passado": "last month", "quanto gastei": "how much did i spend", "quanto ainda tenho no orçamento": "how much budget do i have left" },
  fr: { "ajoute": "add", "ajouter": "add", "note": "record", "enregistre": "record", "reçu": "received", "recu": "received", "gagné": "earned", "gagne": "earned", "salaire": "salary", "revenu": "income", "dépense": "expense", "depense": "expense", "pour": "for", "à": "to", "sur": "on", "de": "of", "épargne": "savings", "epargne": "savings", "économise": "save", "economise": "save", "courses": "groceries", "factures": "bills", "tâche": "task", "tache": "task", "projet": "project", "dette": "debt", "payé": "paid", "paye": "paid", "objectif": "goal", "actif": "asset", "passif": "liability", "stock": "inventory", "vendu": "sold", "vente": "sale", "facture": "invoice", "invité": "guest", "invite": "guest", "habitude": "habit", "publication": "post", "rédige": "draft", "redige": "draft", "programme": "schedule", "ouvre": "open", "affiche": "show", "aujourd'hui": "today", "aujourd’hui": "today", "hier": "yesterday", "mois dernier": "last month", "combien ai-je dépensé": "how much did i spend", "quel budget me reste-t-il": "how much budget do i have left" },
  ru: { "добавь": "add", "добавить": "add", "добавь-ка": "add", "запиши": "record", "записать": "record", "получил": "received", "получила": "received", "получи": "received", "заработал": "earned", "зарплату": "salary", "зарплата": "salary", "доход": "income", "расход": "expense", "потратил": "spent", "на": "for", "в": "in", "сохрани": "save", "отложи": "save", "накопления": "savings", "продукты": "groceries", "счета": "bills", "задачу": "task", "задача": "task", "проект": "project", "долг": "debt", "платёж": "payment", "платеж": "payment", "заплатил": "paid", "цель": "goal", "актив": "asset", "обязательство": "liability", "запасы": "inventory", "продал": "sold", "продажа": "sale", "счёт": "invoice", "счет": "invoice", "гость": "guest", "привычка": "habit", "пост": "post", "черновик": "draft", "запланируй": "schedule", "открой": "open", "покажи": "show", "сегодня": "today", "вчера": "yesterday", "прошлом месяце": "last month", "сколько я потратил": "how much did i spend", "сколько у меня осталось в бюджете": "how much budget do i have left" },
  ar: { "أضف": "add", "اضف": "add", "سجل": "record", "استلمت": "received", "راتب": "salary", "الراتب": "salary", "دخل": "income", "مصروف": "expense", "مصروفات": "expenses", "لـ": "for", "إلى": "to", "ادخر": "save", "وفّر": "save", "بقالة": "groceries", "مشتريات": "groceries", "فواتير": "bills", "مهمة": "task", "مشروع": "project", "دين": "debt", "سددت": "paid", "هدف": "goal", "أصل": "asset", "التزام": "liability", "مخزون": "inventory", "بعت": "sold", "فاتورة": "invoice", "ضيف": "guest", "عادة": "habit", "منشور": "post", "مسودة": "draft", "جدول": "schedule", "افتح": "open", "اعرض": "show", "اليوم": "today", "أمس": "yesterday", "الشهر الماضي": "last month", "كم أنفقت": "how much did i spend", "كم تبقى من ميزانيتي": "how much budget do i have left" },
};

const NAV_AND_QUERY_ALIASES: Record<string, Record<string, string>> = {
  es: { presupuesto: "budget", "planificador de pagos": "paycheck planner", deudas: "debt", "metas de ahorro": "savings goals", facturación: "invoicing", contabilidad: "bookkeeping", inventario: "inventory", ventas: "sales", propiedades: "property", proyectos: "projects", hábitos: "habits", nutrición: "nutrition", boda: "wedding", "flujo de caja": "cash flow", "gasté": "spent", "gaste": "spent" },
  "zh-CN": { 预算: "budget", 债务: "debt", 储蓄目标: "savings goals", 发票管理: "invoicing", 记账: "bookkeeping", 库存管理: "inventory", 销售管理: "sales", 房产: "property", 项目管理: "projects", 习惯追踪: "habits", 营养: "nutrition", 婚礼: "wedding", 现金流: "cash flow" },
  "pt-BR": { orçamento: "budget", dívidas: "debt", economias: "savings", faturamento: "invoicing", contabilidade: "bookkeeping", estoque: "inventory", vendas: "sales", imóveis: "property", projetos: "projects", hábitos: "habits", nutrição: "nutrition", casamento: "wedding", "fluxo de caixa": "cash flow", gastei: "spent" },
  fr: { budget: "budget", dettes: "debt", épargne: "savings", facturation: "invoicing", comptabilité: "bookkeeping", inventaire: "inventory", ventes: "sales", immobilier: "property", projets: "projects", habitudes: "habits", nutrition: "nutrition", mariage: "wedding", trésorerie: "cash flow", dépensé: "spent", dépensée: "spent" },
  ru: { бюджет: "budget", долги: "debt", накопления: "savings", "цели накоплений": "savings goals", счета: "invoicing", "счета-фактуры": "invoicing", бухгалтерия: "bookkeeping", склад: "inventory", продажи: "sales", недвижимость: "property", проекты: "projects", привычки: "habits", питание: "nutrition", свадьба: "wedding", "денежный поток": "cash flow", потратил: "spent", потратила: "spent" },
  ar: { الميزانية: "budget", الديون: "debt", المدخرات: "savings", "أهداف الادخار": "savings goals", الفواتير: "invoicing", المحاسبة: "bookkeeping", المخزون: "inventory", المبيعات: "sales", العقارات: "property", المشاريع: "projects", العادات: "habits", التغذية: "nutrition", الزفاف: "wedding", "التدفق النقدي": "cash flow" },
};

function normalizeLocalizedCommand(input: string, language: string): string {
  const locale = language.split("-")[0] === "zh" ? "zh-CN" : language;
  const aliases = { ...COMMAND_ALIASES[locale], ...NAV_AND_QUERY_ALIASES[locale] };
  let output = input.toLocaleLowerCase();
  // Normalize Arabic-Indic and Eastern Arabic-Indic digits before the shared numeric grammar.
  output = output.replace(/[٠-٩۰-۹]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10));
  if (["es", "pt", "fr", "ru"].includes(locale)) {
    output = output.replace(/(?<=\d)\.(?=\d{3}(?:\D|$))/g, "");
    output = output.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2");
    output = output.replace(/(?<=\d)[\u00a0\u202f ](?=\d{3}(?:\D|$))/g, "");
  }
  // Currency is taken from the user's workspace settings; symbols in commands are just decoration.
  output = output.replace(/[$€£¥₹₽₩]/g, "");
  for (const [localized, english] of Object.entries(aliases).sort(([a], [b]) => b.length - a.length)) {
    const escaped = localized.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = language.startsWith("zh")
      ? output.replaceAll(localized.toLocaleLowerCase(), ` ${english} `)
      : output.replace(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "giu"), english);
  }
  return output.trim();
}
function amountValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw.replaceAll(",", ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function cleanPhrase(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^[\s:,-]+|[\s.!?,;:]+$/g, "");
  return cleaned || undefined;
}

function action(actionId: ActionId, parameters: Record<string, unknown>): DeterministicMatch {
  return { intent: "action", actionId, parameters };
}

function dateFromText(text: string): string | undefined {
  return text.match(/\b(today|yesterday|tomorrow)\b/i)?.[1].toLowerCase();
}

/** Exact, unambiguous read-only questions. Anything fuzzier goes to the model. */
const QUERY_SHORTCUTS: Array<{ pattern: RegExp; actionId: ActionId }> = [
  {
    pattern: /\b(unpaid|outstanding|overdue)\b[^.]*\binvoices?\b|\binvoices?\b[^.]*\b(unpaid|outstanding|overdue)\b/,
    actionId: "invoicing.query_unpaid",
  },
  {
    pattern: /\b(low stock|running low|out of stock|reorder|restock)\b/,
    actionId: "inventory.query_low_stock",
  },
  {
    pattern: /\bcash[\s-]?(flow\s+)?forecast\b|\brunway\b/,
    actionId: "cash-flow.query_forecast",
  },
  {
    pattern: /\b(upcoming|due)\b[^.]*\b(deadlines?|tasks?)\b|\bwhat'?s due\b/,
    actionId: "projects.query_deadlines",
  },
];

function matchTarget(target: string): string | null {
  const t = normalizeName(target);
  if (!t) return null;

  let best: { path: string; score: number } | null = null;
  for (const entry of TARGETS) {
    for (const alias of entry.aliases) {
      if (!alias) continue;
      let score = 0;
      if (alias === t) score = 100;
      else if (t.startsWith(alias) || t.endsWith(alias)) score = 85;
      else if (t.includes(alias) || alias.includes(t)) score = 70;
      if (score > (best?.score ?? 0)) best = { path: entry.path, score };
    }
  }
  return best && best.score >= 70 ? best.path : null;
}

export function deterministicParse(input: string, language = "en"): DeterministicMatch | null {
  const text = normalizeLocalizedCommand(input.trim(), language);
  if (!text) return null;
  const lower = text.toLowerCase();

  // Paycheck, debt, savings, and balance-sheet entries.
  const paycheck = text.match(/^(?:(?:i\s+)?got paid|(?:record|add) (?:a )?paycheck|received (?:a )?paycheck)(?:\s+(?:of|for))?\s+(?:\$\s*)?([\d,]+(?:\.\d{1,2})?)(?:\s+dollars?)?(?:\s+(today|yesterday))?[.!?]?$/i);
  if (paycheck && amountValue(paycheck[1])) return action("paycheck.record_paycheck", { amount: amountValue(paycheck[1]), date: paycheck[2]?.toLowerCase() });

  const debtPayment = text.match(/^(?:(?:i )?(?:paid|pay|record payment of) )(?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (?:towards?|to|on) (?:my )?(.+?)(?:\s+(today|yesterday))?[.!?]?$/i);
  if (debtPayment && amountValue(debtPayment[1]) && cleanPhrase(debtPayment[2])) return action("debt.record_payment", { amount: amountValue(debtPayment[1]), debt: cleanPhrase(debtPayment[2]), date: debtPayment[3]?.toLowerCase() });

  const savings = text.match(/^(?:(?:please )?(?:add|save|contribute|put aside) )(?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (?:to|for) (?:my )?(.+?)(?:\s+(today|yesterday))?[.!?]?$/i);
  const explicitSavings = /^(?:please\s+)?(?:save|contribute|put aside)\b/i.test(text) || /\bto\b/i.test(text);
  if (savings && explicitSavings && amountValue(savings[1]) && cleanPhrase(savings[2])) return action("savings.add_contribution", { amount: amountValue(savings[1]), goal: cleanPhrase(savings[2]), date: savings[3]?.toLowerCase() });

  const asset = text.match(/^(?:(?:please )?(?:add|record|track) )?(?:my )?(.+?) as an? (asset|liability) (?:worth|valued at|of) (?:\$\s*)?([\d,]+(?:\.\d{1,2})?)[.!?]?$/i);
  if (asset && cleanPhrase(asset[1]) && amountValue(asset[3])) return action("net-worth.add_asset", { name: cleanPhrase(asset[1]), value: amountValue(asset[3]), kind: asset[2].toLowerCase() });

  // Business ledger entries. Explicit business wording or the action-example vocabulary is
  // required so a personal budget transaction is never silently routed to bookkeeping.
  const businessEntry = text.match(/^(?:(?:please )?(?:record|add|log) )?(?:(business|bookkeeping) )?(income|revenue|expense|cost) (?:of )?(?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (?:for |from |on )?(.+?)(?:\s+(today|yesterday))?[.!?]?$/i);
  if (businessEntry && amountValue(businessEntry[3]) && cleanPhrase(businessEntry[4]) && (businessEntry[1] || /\b(client|invoice|office|printer|supplies|business|revenue|income|expense|cost)\b/i.test(text))) {
    return action(businessEntry[2] === "income" || businessEntry[2] === "revenue" ? "bookkeeping.record_income" : "bookkeeping.record_expense", { amount: amountValue(businessEntry[3]), description: cleanPhrase(businessEntry[4]), date: businessEntry[5]?.toLowerCase() });
  }
  const businessAmount = text.match(/^(?:please )?(?:record|add|log) (?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (?:for|from|on) (.+?)(?:\s+(today|yesterday))?[.!?]?$/i);
  if (businessAmount && /\b(business|bookkeeping|client payment|printer ink|office|supplies|revenue)\b/i.test(text) && amountValue(businessAmount[1]) && cleanPhrase(businessAmount[2])) {
    return action(/\b(client payment|revenue|income)\b/i.test(text) ? "bookkeeping.record_income" : "bookkeeping.record_expense", { amount: amountValue(businessAmount[1]), description: cleanPhrase(businessAmount[2]), date: businessAmount[3]?.toLowerCase() });
  }
  const clientPayment = text.match(/^(?:please )?(?:record|add|log) (?:a )?(?:client )?payment (?:of )?(?:\$\s*)?([\d,]+(?:\.\d{1,2})?)(?: from (.+?))?(?:\s+(today|yesterday))?[.!?]?$/i);
  if (clientPayment && amountValue(clientPayment[1])) return action("bookkeeping.record_income", { amount: amountValue(clientPayment[1]), description: "Client payment", contact: cleanPhrase(clientPayment[2]), date: clientPayment[3]?.toLowerCase() });
  const recordClientPayment = text.match(/^(?:please )?record (?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (.+?payment)(?:\s+(today|yesterday))?[.!?]?$/i);
  if (recordClientPayment && /\bclient\b/i.test(recordClientPayment[2]) && amountValue(recordClientPayment[1])) return action("bookkeeping.record_income", { amount: amountValue(recordClientPayment[1]), description: cleanPhrase(recordClientPayment[2]), date: recordClientPayment[3]?.toLowerCase() });

  // Operations, life, and work records.
  const stock = text.match(/^(?:(?:please )?(?:add|receive|restock) )?(\d+(?:\.\d+)?) (?:units? of |x )(.+?)[.!?]?$/i);
  if (stock && Number(stock[1]) > 0 && cleanPhrase(stock[2])) return action("inventory.receive", { quantity: Number(stock[1]), product: cleanPhrase(stock[2]) });

  const sale = text.match(/^(?:please )?(?:sold|sell|record sale of) (\d+(?:\.\d+)?) (.+?) at (?:\$\s*)?([\d,]+(?:\.\d{1,2})?) each(?: on (.+))?[.!?]?$/i);
  if (sale && Number(sale[1]) > 0 && cleanPhrase(sale[2]) && amountValue(sale[3])) return action("sales.create_sale", { quantity: Number(sale[1]), description: cleanPhrase(sale[2]), product: cleanPhrase(sale[2]), unitPrice: amountValue(sale[3]), date: cleanPhrase(sale[4]) });

  const invoice = text.match(/^(?:(?:please )?(?:prepare|create|draft)) (?:an? )?invoice for (.+?) for (?:\$\s*)?([\d,]+(?:\.\d{1,2})?)(?: due (.+))?[.!?]?$/i);
  if (invoice && cleanPhrase(invoice[1]) && amountValue(invoice[2])) return action("invoicing.prepare_invoice", { customer: cleanPhrase(invoice[1]), amount: amountValue(invoice[2]), dueDate: cleanPhrase(invoice[3]) });

  const guest = text.match(/^(?:(?:please )?(?:add|invite)) (.+?) to (?:the )?(?:wedding )?guest list[.!?]?$/i);
  if (guest && cleanPhrase(guest[1])) {
    const household = cleanPhrase(guest[1])!;
    const partner = household.match(/^(.+?) and (?:their|her|his) partner$/i);
    return action("wedding.add_guest", { name: partner?.[1] ?? household, household, seats: partner ? 2 : 1 });
  }

  const propertyExpense = text.match(/^(?:(?:please )?(?:add|record|log)) (?:\$\s*)?([\d,]+(?:\.\d{1,2})?) (.+?) (?:cost|expense|to) (?:the )?(.+?)(?: property)?(?:\s+(today|yesterday))?[.!?]?$/i);
  if (propertyExpense && amountValue(propertyExpense[1]) && cleanPhrase(propertyExpense[2]) && cleanPhrase(propertyExpense[3])) return action("property.add_expense", { amount: amountValue(propertyExpense[1]), category: cleanPhrase(propertyExpense[2]), property: cleanPhrase(propertyExpense[3]), date: propertyExpense[4]?.toLowerCase() });

  const food = text.match(/^(?:(?:i )?(?:had|ate|log|logged|add)) (.+?)(?: for (breakfast|lunch|dinner|snack))?(?: (today|yesterday))?[.!?]?$/i);
  if (food && /\b(had|ate|food|breakfast|lunch|dinner|snack|log|logged)\b/i.test(text)) {
    const name = cleanPhrase(food[1].replace(/^(?:two|three|four|five) /i, ""));
    const meal = food[2]?.toLowerCase() ?? (/\bbreakfast\b/i.test(text) ? "breakfast" : undefined);
    if (name) return action("nutrition.log_food", { name, meal, date: food[3]?.toLowerCase() });
  }

  const task = text.match(/^(?:(?:please )?(?:add|create)) (?:a )?task (?:to|for) (.+?)(?: in (?:the )?(.+?))?[.!?]?$/i);
  if (task && cleanPhrase(task[1])) return action("projects.create_task", { title: cleanPhrase(task[1]), project: cleanPhrase(task[2]) });

  const completedTask = text.match(/^(?:please )?(?:mark|complete|finish) (?:the )?(.+?) task as (?:complete|done)[.!?]?$/i);
  if (completedTask && cleanPhrase(completedTask[1])) return action("projects.complete_task", { task: cleanPhrase(completedTask[1]) });

  const habit = text.match(/^(?:please )?(?:mark|complete|log) (?:my )?(.+?) as (?:done|complete)(?: (today|yesterday))?[.!?]?$/i);
  if (habit && cleanPhrase(habit[1])) return action("habits.complete_habit", { habit: cleanPhrase(habit[1]), date: habit[2]?.toLowerCase() });

  const contentSchedule = text.match(/^(?:please )?schedule (?:a |an )?(?:social media )?(?:post|story|reel|video|article|newsletter)(?: about (.+?))? for (.+?)[.!?]?$/i);
  if (contentSchedule) return action("content.schedule_post", { title: cleanPhrase(contentSchedule[1]) ?? "Social media post", platform: /social media/i.test(text) ? "social media" : "instagram", scheduledDate: cleanPhrase(contentSchedule[2]) });

  const contentDraft = text.match(/^(?:please )?(?:draft|write|create) (?:a |an )?(?:post|story|reel|video|article|newsletter)(?: about| on| for)? (.+?)[.!?]?$/i);
  if (contentDraft && cleanPhrase(contentDraft[1])) return action("content.create_draft", { title: cleanPhrase(contentDraft[1]), contentType: "post" });

  // Plain income entries should not need on-device model inference. Support the natural forms
  // shown in the AI examples, including "add salary 1000" and "received $150 freelance".
  const incomeNoun = "(?:salary|income|wages?|pay|freelance(?:\\s+income)?)";
  const amount = "(?:\\$\\s*)?([\\d,]+(?:\\.\\d{1,2})?)";
  const dateSuffix = "(?:\\s+(today|yesterday))?[.!?]?";
  const incomeDescriptionFirst = text.match(
    new RegExp(`^(?:(?:please\\s+)?(?:add|log|record|receive|received|earn|earned)\\s+)?(?:(?:a|an|un|una|une)\\s+)?(${incomeNoun})\\s+(?:of\\s+)?${amount}(?:\\s+dollars?)?${dateSuffix}$`, "i"),
  );
  const incomeAmountFirst = text.match(
    new RegExp(`^(?:please\\s+)?(?:add|log|record|receive|received|earn|earned)\\s+${amount}(?:\\s+dollars?)?\\s+(?:(?:from|for|as)\\s+)?(.+?)${dateSuffix}$`, "i"),
  );
  const incomeMatch = incomeDescriptionFirst ?? (incomeAmountFirst && new RegExp(`\\b${incomeNoun}\\b`, "i").test(incomeAmountFirst[2]) ? incomeAmountFirst : null);
  if (incomeMatch) {
    const amountText = incomeMatch[incomeDescriptionFirst ? 2 : 1];
    const amountValue = Number(amountText.replaceAll(",", ""));
    const description = incomeMatch[incomeDescriptionFirst ? 1 : 2].trim();
    const date = incomeMatch[3]?.toLowerCase();
    if (Number.isFinite(amountValue) && amountValue > 0 && description.length <= 140) {
      return {
        intent: "action",
        actionId: "budget.create_income",
        parameters: { amount: amountValue, description, date },
      };
    }
  }

  // Conservative, typed fallback for a common expense entry. This intentionally accepts only a
  // small, explicit grammar; the normal permission checks and confirmation card still apply.
  const expense = text.match(
    /^(?:(?:please\s+)?(?:add|log|record|spent|spend)\s+)?(?:\$\s*)?([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?\s*)?(?:for|on|at|to)\s+(.+?)(?:\s+(?:today|yesterday))?[.!?]?$/i,
  );
  if (expense && /\b(add|log|record|spent|spend|expense|groceries|coffee|fuel|gas|lunch|dinner|parking|rent|electricity|internet|shopping)\b/i.test(text)) {
    const amount = Number(expense[1].replaceAll(",", ""));
    const description = expense[2].trim().replace(/[.!?]+$/, "");
    if (Number.isFinite(amount) && amount > 0 && description && description.length <= 140) {
      const date = /\byesterday\b/i.test(text) ? "yesterday" : undefined;
      return {
        intent: "action",
        actionId: "budget.create_expense",
        parameters: { amount, description, date },
      };
    }
  }

  if (/\b(how much did i spend|spending summary|spend summary)\b/i.test(text)) {
    const period = text.match(/\b(today|yesterday|this week|last week|this month|last month|this year|last year)\b/i)?.[1];
    return { intent: "query", actionId: "budget.query_spend", parameters: { period } };
  }
  if (/\b(budget remaining|how much (?:budget|money) (?:do i have )?left|remaining budget)\b/i.test(text)) {
    const month = text.match(/\b(this month|last month|this year|last year)\b/i)?.[1];
    return { intent: "query", actionId: "budget.query_remaining", parameters: { month } };
  }
  if (/\bhow many calories (?:have i had|did i have)|nutrition summary\b/i.test(text)) {
    return { intent: "query", actionId: "nutrition.query_summary", parameters: { date: dateFromText(text) } };
  }

  for (const shortcut of QUERY_SHORTCUTS) {
    if (shortcut.pattern.test(lower)) {
      return { intent: "query", actionId: shortcut.actionId, parameters: {} };
    }
  }

  const nav = lower.match(NAV_VERB);
  if (nav) {
    const path = matchTarget(nav[1]);
    if (path) return { intent: "navigation", path };
  }

  // "budget" on its own is a navigation request, but only when it is a bare tool name.
  const bare = matchTarget(lower);
  if (bare && normalizeName(lower).split(" ").length <= 3) {
    return { intent: "navigation", path: bare };
  }

  return null;
}

export function toolIdForPath(path: string): ToolId | undefined {
  return TOOLS.find((t) => t.route === path)?.id;
}
