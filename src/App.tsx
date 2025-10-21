// App.tsx — UX móvil mejorado (borrar "0", teclado numérico, botones con íconos)
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Users, Wallet, Receipt, Copy, RefreshCw, ArrowRight } from "lucide-react";

// ---------------- Types ----------------
interface Family { name: string; attendees: string; }        // <- string para permitir vacío
interface Expense { payer: string; amount: string; note?: string; } // <- string para permitir vacío

// ---------------- Utils ----------------
function currency(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(n);
}

function defaultEventName(d = new Date()) {
  const h = d.getHours();
  const meal = h < 11 ? "Desayuno" : h < 16 ? "Almuerzo" : "Cena";
  const fecha = d.toLocaleDateString("es-CR", { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${meal} ${fecha}`;
}

const SMALL = 0.005;

function settleGreedy(net: Record<string, number>) {
  const creditors: [string, number][] = [];
  const debtors: [string, number][] = [];
  Object.entries(net).forEach(([k, v]) => {
    if (v > SMALL) creditors.push([k, v]);
    else if (v < -SMALL) debtors.push([k, -v]);
  });
  creditors.sort((a, b) => b[1] - a[1]);
  debtors.sort((a, b) => b[1] - a[1]);
  const settlements: { from: string; to: string; amount: number }[] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i][1], creditors[j][1]);
    settlements.push({ from: debtors[i][0], to: creditors[j][0], amount: Math.round(pay * 100) / 100 });
    debtors[i][1] = Math.round((debtors[i][1] - pay) * 100) / 100;
    creditors[j][1] = Math.round((creditors[j][1] - pay) * 100) / 100;
    if (debtors[i][1] <= SMALL) i++;
    if (creditors[j][1] <= SMALL) j++;
  }
  return settlements;
}

// Parsing seguro (strings -> números)
const toInt = (s: string) => {
  const n = parseInt(s.replace(/\D+/g, "") || "0", 10);
  return isNaN(n) ? 0 : n;
};
const toMoney = (s: string) => {
  const n = parseFloat(s.replace(/[^\d.]/g, "") || "0");
  return isNaN(n) ? 0 : n;
};




// Core compute
function compute(families: Family[], expenses: Expense[]) {
  const totalPeople = families.reduce((s, f) => s + toInt(f.attendees), 0);
  const totalSpent = expenses.reduce((s, e) => s + toMoney(e.amount), 0);
  const perPersonShare = totalPeople > 0 ? totalSpent / totalPeople : 0;

  const shares: Record<string, number> = {};
  families.forEach(f => { shares[f.name] = perPersonShare * toInt(f.attendees); });

  const paid: Record<string, number> = {};
  families.forEach(f => { paid[f.name] = 0; });
  expenses.forEach(e => {
    if (!(e.payer in paid)) paid[e.payer] = 0;
    paid[e.payer] += toMoney(e.amount);
  });

  const net: Record<string, number> = {};
  families.forEach(f => {
    net[f.name] = Math.round((paid[f.name] - (shares[f.name] || 0)) * 100) / 100;
  });

  const settlements = settleGreedy(net);
  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    perPersonShare: Math.round(perPersonShare * 100) / 100,
    shares, paid, net, settlements,
    totalPeople
  };
}



// ---------------- Main component ----------------
export default function ExpenseSplitterApp() {
  const [eventName, setEventName] = useState<string>(() => defaultEventName());
  const [notes, setNotes] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<"families"|"expenses"|"insights">("families");

  // refs para autofocus inicial y evitar que el teclado tape
  const firstNameRef = useRef<HTMLInputElement | null>(null);

  // Limpia seeds del localStorage si venían de una versión previa
  useEffect(() => {
    const saved = localStorage.getItem("expense-splitter-state");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.eventName) setEventName(s.eventName);
        if (s.notes) setNotes(s.notes);
        if (Array.isArray(s.families)) {
          // tolerar versiones antiguas numéricas
          setFamilies(s.families.map((f: any) => ({ name: f.name ?? "", attendees: String(f.attendees ?? 0) })));
        }
        if (Array.isArray(s.expenses)) {
          setExpenses(s.expenses.map((e: any) => ({ payer: e.payer ?? "", amount: String(e.amount ?? 0), note: e.note ?? "" })));
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "expense-splitter-state",
      JSON.stringify({ eventName, notes, families, expenses })
    );
  }, [eventName, notes, families, expenses]);

  // Autofocus en móvil: levanta teclado y centra el input para que no lo tape
  useEffect(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
    if (isMobile && firstNameRef.current) {
      setTimeout(() => {
        firstNameRef.current?.focus();
        firstNameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 100);
    }
  }, []);

  const result = useMemo(() => compute(families, expenses), [families, expenses]);

  // Actions
  const addFamily = () => setFamilies([...families, { name: `Familia ${families.length + 1}`, attendees: "" }]);
  const removeFamily = (idx: number) => setFamilies(families.filter((_, i) => i !== idx));
  const updateFamily = (idx: number, patch: Partial<Family>) =>
    setFamilies(families.map((f, i) => (i === idx ? { ...f, ...patch } : f)));

  const addExpense = () =>
    setExpenses([...expenses, { payer: families[0]?.name || "", amount: "", note: "" }]);
  const removeExpense = (idx: number) => setExpenses(expenses.filter((_, i) => i !== idx));
  const updateExpense = (idx: number, patch: Partial<Expense>) =>
    setExpenses(expenses.map((e, i) => (i === idx ? { ...e, ...patch } : e)));




    // Helper: enfoca el primer input de la última fila agregada
    const focusLast = (selector: string) => {
      setTimeout(() => {
        const el = document.querySelector(selector) as HTMLInputElement | null;
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
    };

    // Enter en filas de Familias
    const onFamilyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addFamily();
        // Enfoca el nombre de la NUEVA fila
        focusLast('[data-family-row="last"][data-field="name"]');
      }
    };

    // Enter en filas de Gastos
    const onExpenseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addExpense();
        // Enfoca el payer (select) del nuevo gasto
        focusLast('[data-expense-row="last"][data-field="payer"]');
      }
    };







  const resetFamilies = () => {
    if (!confirm("¿Reiniciar familias? Esto borrará las familias y asistentes.")) return;
    setFamilies([]);
  };
  const resetExpenses = () => {
    if (!confirm("¿Reiniciar gastos? Esto borrará todos los ítems de gasto.")) return;
    setExpenses([]);
  };

  const copyInstructions = async () => {
    const lines: string[] = [];
    lines.push(`Evento: ${eventName}`);
    lines.push(
      `Total: ${currency(result.totalSpent)} | Personas: ${result.totalPeople} | Por persona: ${currency(
        result.perPersonShare
      )}`
    );
    lines.push("");
    lines.push("Pagos sugeridos:");
    result.settlements.forEach((s) => lines.push(`• ${s.from} → ${s.to}: ${currency(s.amount)}`));
    lines.push("");
    lines.push("Resumen por familia (Pagado / Cuota / Neto):");
    families.forEach((f) => {
      lines.push(
        `• ${f.name}: ${currency(result.paid[f.name] || 0)} / ${currency(
          result.shares[f.name] || 0
        )} / ${currency(result.net[f.name] || 0)}`
      );
    });
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {}
  };

  // Handlers de foco para inputs numéricos: si es "0" -> limpiar, y centrar en viewport
  const focusBehavior = (el: HTMLInputElement | null) => {
    if (!el) return;
    if (el.value === "0") {
      // limpiar para que el usuario no tenga que borrar
      el.value = "";
      const ev = new Event("input", { bubbles: true });
      el.dispatchEvent(ev);
    }
    // evitar que el teclado tape el campo
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 max-w-4xl mx-auto">
      <header className="mb-3 text-center">
        <h1 className="text-2xl font-bold">Family Expense Splitter</h1>
      </header>

      <Card className="mb-3">
        <CardContent className="p-4 grid gap-2">
          <Input
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="Nombre del evento"
          />
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <Badge variant="secondary">
              <Users className="w-4 h-4 mr-1" /> {result.totalPeople} personas
            </Badge>
            <Badge variant="secondary">
              <Wallet className="w-4 h-4 mr-1" /> Total {currency(result.totalSpent)}
            </Badge>
            <Badge variant="secondary">
              <Receipt className="w-4 h-4 mr-1" /> {currency(result.perPersonShare)} por persona
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stepper as tabs */}
      <Tabs value={tab} onValueChange={(v)=>setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full mb-2">
          <TabsTrigger value="families" className="flex-1">Familias</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1">Gastos</TabsTrigger>
          <TabsTrigger value="insights" className="flex-1">Resumen</TabsTrigger>
        </TabsList>

        {/* Step 1: Families */}
        <TabsContent value="families">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Familias y asistentes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {families.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2">
                 <Input
                  // Nombre
                  data-family-row={idx === families.length - 1 ? "last" : idx}
                  data-field="name"
                  value={f.name}
                  onChange={(e) => updateFamily(idx, { name: e.target.value })}
                  placeholder="Nombre familia"
                  onKeyDown={onFamilyKeyDown}
                  enterKeyHint="next"
                />

                <Input
                  // Asistentes (numérico “suave”)
                  data-family-row={idx === families.length - 1 ? "last" : idx}
                  data-field="attendees"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={f.attendees}
                  onFocus={(e) => focusBehavior(e.currentTarget)}
                  onClick={(e) => focusBehavior(e.currentTarget)}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D+/g, "");
                    updateFamily(idx, { attendees: val });
                  }}
                  onKeyDown={onFamilyKeyDown}
                  enterKeyHint="done"
                  className="w-24"
                />

                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => removeFamily(idx)}
                    aria-label="Eliminar familia"
                    title="Eliminar"
                    className="min-h-[44px] min-w-[44px]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {/* +, refresh, seguir */}
                <Button onClick={addFamily} size="icon" aria-label="Agregar familia" title="Agregar" className="min-h-[44px] min-w-[44px]">
                  <Plus className="w-5 h-5" />
                </Button>
                <Button variant="destructive" onClick={resetFamilies} size="icon" aria-label="Reiniciar familias" title="Reiniciar" className="min-h-[44px] min-w-[44px]">
                  <RefreshCw className="w-5 h-5" />
                </Button>
                <Button variant="secondary" onClick={() => setTab("expenses")} size="icon" aria-label="Siguiente" title="Siguiente" className="min-h-[44px] min-w-[44px]">
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 2: Expenses */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Gastos / aportes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {expenses.map((e, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-2 items-center">
                  <select
                    className="col-span-6 sm:col-span-2 border rounded px-2 h-11"
                    value={e.payer}
                    onChange={(ev) => updateExpense(idx, { payer: ev.target.value })}
                    onFocus={(ev) => (ev.currentTarget as HTMLSelectElement).scrollIntoView({ block: "center", behavior: "smooth" })}
                  >
                    {families.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>

                  {/* Monto: text + inputMode numérico; borrar “0” al foco */}

                  <Input
                    // Monto
                    data-expense-row={idx === expenses.length - 1 ? "last" : idx}
                    data-field="amount"
                    className="col-span-3 sm:col-span-2"
                    inputMode="decimal"
                    placeholder="0"
                    value={e.amount}
                    onFocus={(ev) => focusBehavior(ev.currentTarget)}
                    onClick={(ev) => focusBehavior(ev.currentTarget)}
                    onChange={(ev) => {
                      const cleaned = ev.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
                      updateExpense(idx, { amount: cleaned });
                    }}
                    onKeyDown={onExpenseKeyDown}
                    enterKeyHint="next"
                  />

                  <Input
                    // Descripción
                    data-expense-row={idx === expenses.length - 1 ? "last" : idx}
                    data-field="note"
                    className="col-span-3 sm:col-span-2"
                    value={e.note || ""}
                    onChange={(ev) => updateExpense(idx, { note: ev.target.value })}
                    placeholder="Descripción (opcional)"
                    onFocus={(e) => e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" })}
                    onKeyDown={onExpenseKeyDown}
                    enterKeyHint="done"
                  />

                  <div className="col-span-6 flex justify-end">
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => removeExpense(idx)}
                      aria-label="Eliminar gasto"
                      title="Eliminar"
                      className="min-h-[44px] min-w-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Separator className="col-span-6" />
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {/* +, refresh, seguir */}
                <Button onClick={addExpense} size="icon" aria-label="Agregar gasto" title="Agregar gasto" className="min-h-[44px] min-w-[44px]">
                  <Plus className="w-5 h-5" />
                </Button>
                <Button variant="destructive" onClick={resetExpenses} size="icon" aria-label="Reiniciar gastos" title="Reiniciar" className="min-h-[44px] min-w-[44px]">
                  <RefreshCw className="w-5 h-5" />
                </Button>
                <Button variant="secondary" onClick={() => setTab("insights")} size="icon" aria-label="Siguiente" title="Siguiente" className="min-h-[44px] min-w-[44px]">
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Step 3: Summary + Settlements in one view */}
        <TabsContent value="insights">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Resumen por familia</CardTitle>
            </CardHeader>

            <CardContent className="grid gap-4">
              <div className="overflow-x-auto">
                <table className="w-full table-auto border border-gray-200 rounded-md text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-2 sm:px-3 py-2 border-b">Familia</th>
                      <th className="text-right px-2 sm:px-3 py-2 border-b">Aportó</th>
                      <th className="text-right px-2 sm:px-3 py-2 border-b">Cuota</th>
                      <th className="text-right px-2 sm:px-3 py-2 border-b">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {families.map((f) => {
                      const paid = result.paid[f.name] || 0;
                      const share = result.shares[f.name] || 0;
                      const net = result.net[f.name] || 0;
                      const positive = net > 0.005;
                      const negative = net < -0.005;
                      return (
                        <tr key={f.name} className="hover:bg-gray-50">
                          <td className="px-2 sm:px-3 py-2 border-b">{f.name}</td>
                          <td className="px-2 sm:px-3 py-2 border-b text-right whitespace-nowrap">
                            {currency(paid)}
                          </td>
                          <td className="px-2 sm:px-3 py-2 border-b text-right whitespace-nowrap">
                            {currency(share)}
                          </td>
                          <td
                            className={[
                              "px-2 sm:px-3 py-2 border-b text-right font-semibold whitespace-nowrap",
                              positive ? "text-green-600" : negative ? "text-red-600" : "text-gray-900",
                            ].join(" ")}
                          >
                            {currency(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td className="px-2 sm:px-3 py-2 border-t font-medium">Totales</td>
                      <td className="px-2 sm:px-3 py-2 border-t text-right font-medium whitespace-nowrap">
                        {currency(families.reduce((s, f) => s + (result.paid[f.name] || 0), 0))}
                      </td>
                      <td className="px-2 sm:px-3 py-2 border-t text-right font-medium whitespace-nowrap">
                        {currency(families.reduce((s, f) => s + (result.shares[f.name] || 0), 0))}
                      </td>
                      <td className="px-2 sm:px-3 py-2 border-t text-right font-medium whitespace-nowrap">
                        {currency(families.reduce((s, f) => s + (result.net[f.name] || 0), 0))}
                      </td>
                      <td className="px-2 sm:px-3 py-2 border-t" />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pagos sugeridos debajo */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-gray-100">
                    ⇄
                  </span>
                  <span>Pagos sugeridos (mínimo número)</span>
                </div>

                <div className="grid gap-2">
                  {result.settlements.length === 0 && (
                    <div className="text-sm text-muted-foreground">No hay pagos pendientes.</div>
                  )}
                  {result.settlements.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span className="truncate">
                        {s.from} → {s.to}
                      </span>
                      <span className="font-semibold whitespace-nowrap">{currency(s.amount)}</span>
                    </div>
                  ))}
                </div>

                {/* Botón copiar grande */}
                <div className="pt-1">
                  <Button onClick={copyInstructions} className="w-full h-12 text-base">
                    <Copy className="w-5 h-5 mr-2" />
                    Copiar instrucciones
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
