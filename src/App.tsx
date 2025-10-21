// App.tsx — versión optimizada para UX y responsividad
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Users, Wallet, Receipt, Copy } from "lucide-react";

// === Tipos ===
interface Family { name: string; attendees: number; }
interface Expense { payer: string; amount: number; note?: string; }

// === Utilidades ===
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
    settlements.push({ from: debtors[i][0], to: creditors[j][0], amount: pay });
    debtors[i][1] -= pay; creditors[j][1] -= pay;
    if (debtors[i][1] <= SMALL) i++;
    if (creditors[j][1] <= SMALL) j++;
  }
  return settlements;
}

function compute(families: Family[], expenses: Expense[]) {
  const totalPeople = families.reduce((s, f) => s + (f.attendees || 0), 0);
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const perPersonShare = totalPeople > 0 ? totalSpent / totalPeople : 0;

  const shares: Record<string, number> = {};
  families.forEach(f => { shares[f.name] = perPersonShare * (f.attendees || 0); });

  const paid: Record<string, number> = {};
  families.forEach(f => { paid[f.name] = 0; });
  expenses.forEach(e => { paid[e.payer] = (paid[e.payer] || 0) + e.amount; });

  const net: Record<string, number> = {};
  families.forEach(f => { net[f.name] = +(paid[f.name] - (shares[f.name] || 0)).toFixed(2); });

  return {
    totalSpent: +totalSpent.toFixed(2),
    perPersonShare: +perPersonShare.toFixed(2),
    shares, paid, net,
    settlements: settleGreedy(net),
    totalPeople
  };
}

// === Componente principal ===
export default function ExpenseSplitterApp() {
  const [eventName, setEventName] = useState(defaultEventName());
  const [notes, setNotes] = useState("");
  const [families, setFamilies] = useState<Family[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState("families");

  useEffect(() => {
    const saved = localStorage.getItem("expense-splitter-state");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.eventName) setEventName(s.eventName);
        if (s.notes) setNotes(s.notes);
        if (s.families) setFamilies(s.families);
        if (s.expenses) setExpenses(s.expenses);
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem("expense-splitter-state", JSON.stringify({ eventName, notes, families, expenses }));
  }, [eventName, notes, families, expenses]);

  const result = useMemo(() => compute(families, expenses), [families, expenses]);

  const resetFamilies = () => { if (confirm("¿Reiniciar familias?")) setFamilies([]); };
  const resetExpenses = () => { if (confirm("¿Reiniciar gastos?")) setExpenses([]); };

  const copyInstructions = async () => {
    const lines = [
      `Evento: ${eventName}`,
      `Total: ${currency(result.totalSpent)} | Personas: ${result.totalPeople} | Por persona: ${currency(result.perPersonShare)}`,
      "", "Pagos sugeridos:",
      ...result.settlements.map(s => `• ${s.from} → ${s.to}: ${currency(s.amount)}`),
      "", "Resumen por familia (Pagado / Cuota / Neto):",
      ...families.map(f => `• ${f.name}: ${currency(result.paid[f.name] || 0)} / ${currency(result.shares[f.name] || 0)} / ${currency(result.net[f.name] || 0)}`)
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
  };

  // === Render ===
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 sm:px-4 lg:px-8 py-6 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <header className="mb-4 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold">Family Expense Splitter</h1>
        </header>

        <Card className="mb-4 shadow-sm">
          <CardContent className="p-4 grid gap-2">
            <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Nombre del evento" />
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" />
            <div className="flex flex-wrap gap-2 text-sm justify-center sm:justify-start">
              <Badge variant="secondary"><Users className="w-4 h-4 mr-1" /> {result.totalPeople} personas</Badge>
              <Badge variant="secondary"><Wallet className="w-4 h-4 mr-1" /> {currency(result.totalSpent)}</Badge>
              <Badge variant="secondary"><Receipt className="w-4 h-4 mr-1" /> {currency(result.perPersonShare)} por persona</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full mb-3">
            <TabsTrigger className="flex-1 text-xs sm:text-sm" value="families">1. Familias</TabsTrigger>
            <TabsTrigger className="flex-1 text-xs sm:text-sm" value="expenses">2. Gastos</TabsTrigger>
            <TabsTrigger className="flex-1 text-xs sm:text-sm" value="insights">3. Resumen</TabsTrigger>
          </TabsList>

          {/* Familias */}
          <TabsContent value="families">
            <Card className="shadow-sm">
              <CardHeader><CardTitle>Familias y asistentes</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {families.map((f, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2">
                    <Input className="flex-1" value={f.name} onChange={(e) => {
                      const arr = [...families]; arr[idx].name = e.target.value; setFamilies(arr);
                    }} />
                    <Input type="number" min={0} className="w-full sm:w-24"
                      value={f.attendees} onChange={(e) => {
                        const arr = [...families]; arr[idx].attendees = Number(e.target.value); setFamilies(arr);
                      }} />
                    <Button variant="destructive" size="icon" onClick={() => setFamilies(families.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Button onClick={() => setFamilies([...families, { name: `Familia ${families.length + 1}`, attendees: 1 }])}><Plus className="w-4 h-4 mr-1" />Agregar</Button>
                  <Button variant="destructive" onClick={resetFamilies}>Reiniciar</Button>
                  <Button variant="secondary" onClick={() => setTab("expenses")}>Siguiente</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Gastos */}
          <TabsContent value="expenses">
            <Card className="shadow-sm">
              <CardHeader><CardTitle>Gastos / aportes</CardTitle></CardHeader>
              <CardContent className="grid gap-3 overflow-x-auto">
                {expenses.map((e, idx) => (
                  <div key={idx} className="grid sm:grid-cols-6 gap-2 items-center">
                    <select className="col-span-6 sm:col-span-2 border rounded px-2 h-10" value={e.payer}
                      onChange={(ev) => { const arr = [...expenses]; arr[idx].payer = ev.target.value; setExpenses(arr); }}>
                      {families.map((f) => (<option key={f.name} value={f.name}>{f.name}</option>))}
                    </select>
                    <Input type="number" min={0} className="col-span-3 sm:col-span-2" value={e.amount}
                      onChange={(ev) => { const arr = [...expenses]; arr[idx].amount = Number(ev.target.value); setExpenses(arr); }} />
                    <Input className="col-span-3 sm:col-span-2" value={e.note || ""} placeholder="Descripción (opcional)"
                      onChange={(ev) => { const arr = [...expenses]; arr[idx].note = ev.target.value; setExpenses(arr); }} />
                    <div className="col-span-6 flex justify-end"><Button variant="destructive" size="icon" onClick={() => setExpenses(expenses.filter((_, i) => i !== idx))}><Trash2 className="w-4 h-4" /></Button></div>
                    <Separator className="col-span-6" />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Button onClick={() => setExpenses([...expenses, { payer: families[0]?.name || "", amount: 0 }])}><Plus className="w-4 h-4 mr-1" />Agregar gasto</Button>
                  <Button variant="destructive" onClick={resetExpenses}>Reiniciar</Button>
                  <Button variant="secondary" onClick={() => setTab("insights")}>Siguiente</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resumen */}
          <TabsContent value="insights">
            <Card className="shadow-sm">
              <CardHeader><CardTitle>Resumen por familia</CardTitle></CardHeader>
              <CardContent className="grid gap-4 overflow-x-auto">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs sm:text-sm md:text-base">
                    <thead><tr className="bg-gray-100"><th className="text-left px-2 py-1">Familia</th><th className="text-right px-2 py-1">Aportó</th><th className="text-right px-2 py-1">Cuota</th><th className="text-right px-2 py-1">Neto</th></tr></thead>
                    <tbody>
                      {families.map(f => (
                        <tr key={f.name} className="border-t hover:bg-gray-50">
                          <td className="px-2 py-1">{f.name}</td>
                          <td className="px-2 py-1 text-right">{currency(result.paid[f.name] || 0)}</td>
                          <td className="px-2 py-1 text-right">{currency(result.shares[f.name] || 0)}</td>
                          <td className={`px-2 py-1 text-right font-semibold ${result.net[f.name] > 0 ? "text-green-600" : result.net[f.name] < 0 ? "text-red-600" : ""}`}>
                            {currency(result.net[f.name])}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-2">
                  <h3 className="text-sm sm:text-base font-semibold">Pagos sugeridos</h3>
                  {result.settlements.length === 0
                    ? <div className="text-sm text-muted-foreground">No hay pagos pendientes.</div>
                    : result.settlements.map((s, i) => (
                        <div key={i} className="flex justify-between border rounded-md px-3 py-2 text-sm sm:text-base">
                          <span className="truncate">{s.from} → {s.to}</span>
                          <span className="font-semibold">{currency(s.amount)}</span>
                        </div>
                      ))}
                  <Button onClick={copyInstructions} className="w-full sm:w-auto h-12 text-base mt-2 hover:scale-[1.02] transition"><Copy className="w-5 h-5 mr-2" />Copiar instrucciones</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
