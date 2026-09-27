import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Filter, Building2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAccess } from "@/hooks/use-access";
import { useServerFn } from "@tanstack/react-start";
import {
  getFinanceiroStats,
  createExpense,
  updateExpense,
  deleteExpense,
  getBranchesByCompany,
} from "@/lib/financeiro.functions";
import { getCompanyDisplayName, getBranchDisplayName } from "@/lib/name-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/financeiro/despesas")({
  head: () => ({ meta: [{ title: "Investimentos de Ativação | Manos Tech" }] }),
  component: GastosAtivacaoPage,
});

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CATEGORIES = [
  { value: "materiais", label: "Materiais" },
  { value: "deslocamento", label: "Deslocamento" },
  { value: "sistema", label: "Sistema" },
  { value: "outros", label: "Outros" },
];

const EXPENSE_TYPES = [
  { value: "ativacao_matriz", label: "Ativação de Matriz" },
  { value: "ativacao_filial", label: "Ativação de Filial" },
];

interface ExpenseRow {
  id: string;
  company_id: string;
  branch_id: string | null;
  category: string;
  type: string;
  description: string;
  amount: number;
  date: string;
  competence: string;
  payment_method: string;
  status: string;
  observation?: string | null;
  companies: {
    name: string;
    trade_name?: string | null;
    legal_name?: string | null;
  } | null;
  branches?: {
    name: string;
    trade_name?: string | null;
    legal_name?: string | null;
  } | null;
}

function GastosAtivacaoPage() {
  const { data: access } = useAccess();
  const canManageInvestments = access?.role === "adm" || access?.role === "revenda";
  const isReseller = access?.role === "revenda";
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("ativacao_matriz");
  const [selectedCategory, setSelectedCategory] = useState<string>("materiais");
  const [filterPeriod, setFilterPeriod] = useState("este-mes");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const getBranchesFn = useServerFn(getBranchesByCompany);
  const branchesQuery = useQuery({
    queryKey: ["branches", selectedCompanyId],
    enabled: !!selectedCompanyId,
    queryFn: () => getBranchesFn({ data: selectedCompanyId }),
  });

  const getStatsFn = useServerFn(getFinanceiroStats);
  const statsQuery = useQuery({
    queryKey: ["financeiro-stats", filterPeriod],
    enabled: !!access,
    queryFn: () => getStatsFn({ data: { period: filterPeriod } }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ExpenseRow>) => createExpense({ data }),
    onSuccess: () => {
      toast.success("Investimento registrado com sucesso");
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["financeiro-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao registrar gasto"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseRow> }) =>
      updateExpense({ data: { id, updates } }),
    onSuccess: () => {
      toast.success("Investimento atualizado com sucesso");
      setIsModalOpen(false);
      setEditingExpense(null);
      queryClient.invalidateQueries({ queryKey: ["financeiro-stats"] });
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao atualizar gasto"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense({ data: id }),
    onSuccess: () => {
      toast.success("Investimento removido");
      queryClient.invalidateQueries({ queryKey: ["financeiro-stats"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "Erro ao remover gasto";
      toast.error(message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get("amount"));
    const dateValue = formData.get("date") as string;

    if (amount <= 0) {
      toast.error("O valor deve ser maior que zero");
      return;
    }

    if (!dateValue) {
      toast.error("A data é obrigatória");
      return;
    }

    // Gerar competência automaticamente: MM/AAAA
    const [year, month] = dateValue.split("-");
    const competence = `${month}/${year}`;

    const payload: Partial<ExpenseRow> = {
      company_id: selectedCompanyId,
      branch_id: selectedType === "ativacao_filial" ? selectedBranchId : null,
      category: selectedCategory,
      type: selectedType,
      description: (formData.get("description") as string) || "",
      amount,
      date: dateValue,
      competence,
      payment_method: "Dinheiro", // Valor padrão para evitar erro de NOT NULL
      status: "pago", // Despesas internas ADM já nascem como pagas
      observation: (formData.get("observation") as string) || null,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, updates: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const allExpenses: ExpenseRow[] = statsQuery.data?.expenses || [];

  // Filtros
  const filteredExpenses = allExpenses.filter((e) => {
    const matchCompany = filterCompany === "all" || e.company_id === filterCompany;
    const matchType = filterType === "all" || e.category === filterType;
    return matchCompany && matchType;
  });

  const totalGeral = filteredExpenses.reduce((sum: number, e) => sum + Number(e.amount), 0);

  // Extrair empresas únicas para o filtro
  const companies = Array.from(
    new Set(
      allExpenses.map((e) =>
        JSON.stringify({ id: e.company_id, name: getCompanyDisplayName(e.companies) }),
      ),
    ),
  )
    .map((s) => JSON.parse(s) as { id: string; name: string })
    .filter((c) => c.id);

  if (access?.role !== "adm" && access?.role !== "matriz" && access?.role !== "revenda") {
    return <div className="p-8 text-center">Acesso restrito.</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <RouterLink to="/financeiro">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-5" />
            </Button>
          </RouterLink>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Investimentos de Ativação</h1>
            <p className="text-muted-foreground">
              {isReseller
                ? "Controle interno dos investimentos nas ativações da sua rede"
                : "Controle interno de investimentos em ativação de matrizes e filiais"}
            </p>
          </div>
        </div>

        {canManageInvestments && (
          <Dialog
            open={isModalOpen}
            onOpenChange={(open) => {
              setIsModalOpen(open);
              if (!open) {
                setEditingExpense(null);
                setSelectedCompanyId("");
                setSelectedBranchId("");
                setSelectedType("ativacao_matriz");
                setSelectedCategory("materiais");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Novo investimento de ativação
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingExpense ? "Editar Investimento" : "Novo Investimento de Ativação"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Empresa Matriz</Label>
                    <Select
                      name="company_id"
                      defaultValue={editingExpense?.company_id || ""}
                      onValueChange={(val) => {
                        setSelectedCompanyId(val);
                        setSelectedBranchId(""); // Limpar filial ao trocar matriz
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a matriz" />
                      </SelectTrigger>
                      <SelectContent>
                        {statsQuery.data?.allCompanies?.map(
                          (comp: {
                            id: string;
                            name: string;
                            trade_name?: string | null;
                            legal_name?: string | null;
                          }) => (
                            <SelectItem key={comp.id} value={comp.id}>
                              {getCompanyDisplayName(comp)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Ativação</Label>
                    <Select
                      name="type"
                      defaultValue={editingExpense?.type || "ativacao_matriz"}
                      onValueChange={(val) => {
                        setSelectedType(val);
                        if (val === "ativacao_matriz") setSelectedBranchId("");
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      name="category"
                      defaultValue={editingExpense?.category || "materiais"}
                      onValueChange={(val) => setSelectedCategory(val)}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      defaultValue={editingExpense?.amount}
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição do Investimento</Label>
                  <Input
                    name="description"
                    defaultValue={editingExpense?.description}
                    placeholder="Ex: Configuração Mikrotik, Cabeamento..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data do Investimento</Label>
                    <Input
                      name="date"
                      type="date"
                      defaultValue={editingExpense?.date || new Date().toISOString().split("T")[0]}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={selectedType === "ativacao_matriz" ? "hidden" : ""}>
                      Filial
                    </Label>
                    <div className={selectedType === "ativacao_matriz" ? "hidden" : ""}>
                      <Select
                        name="branch_id"
                        value={selectedBranchId || editingExpense?.branch_id || ""}
                        onValueChange={(val) => setSelectedBranchId(val)}
                        disabled={selectedType === "ativacao_matriz" || !selectedCompanyId}
                        required={selectedType === "ativacao_filial"}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedCompanyId
                                ? "Selecione a matriz primeiro"
                                : "Selecione a filial"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {branchesQuery.data?.map(
                            (branch: {
                              id: string;
                              name: string;
                              trade_name?: string | null;
                              legal_name?: string | null;
                            }) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {getBranchDisplayName(branch)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Textarea
                    name="observation"
                    defaultValue={editingExpense?.observation || ""}
                    placeholder="Detalhes adicionais..."
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingExpense ? "Salvar Alterações" : "Registrar Investimento"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-full">
              <HardDrive className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Total em Investimentos
              </p>
              <h3 className="text-2xl font-bold">{brl(totalGeral)}</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7-dias">7 Dias</SelectItem>
                <SelectItem value="este-mes">Este mês</SelectItem>
                <SelectItem value="mes-anterior">Mês anterior</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterCompany} onValueChange={setFilterCompany}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Matriz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Matrizes</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Tipo de Ativação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {EXPENSE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table className="hidden sm:table">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Empresa / Filial</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo / Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {canManageInvestments && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExpenses.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageInvestments ? 6 : 5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Nenhum gasto encontrado para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredExpenses.map((e: ExpenseRow) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm flex items-center gap-1">
                          <Building2 className="size-3" />{" "}
                          {getCompanyDisplayName(e.companies) || "Empresa não identificada"}
                        </span>
                        {e.branches && (
                          <span className="text-xs text-muted-foreground italic">
                            Filial: {getBranchDisplayName(e.branches)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase w-fit ${
                            e.type === "ativacao_matriz"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {e.type === "ativacao_matriz" ? "Matriz" : "Filial"}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                          {e.category}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold text-destructive">
                      {brl(Number(e.amount))}
                    </TableCell>
                    {canManageInvestments && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingExpense(e);
                              setSelectedCompanyId(e.company_id);
                              setSelectedBranchId(e.branch_id || "");
                              setSelectedType(e.type || "ativacao_matriz");
                              setSelectedCategory(e.category || "materiais");
                              setIsModalOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Deseja realmente excluir este lançamento?")) {
                                deleteMutation.mutate(e.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Mobile View */}
          <div className="sm:hidden flex flex-col divide-y divide-border">
            {filteredExpenses.map((e: ExpenseRow) => (
              <div key={e.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    {format(new Date(e.date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span className="font-bold text-destructive">{brl(Number(e.amount))}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm">
                    {getCompanyDisplayName(e.companies) || "Empresa não identificada"}
                  </span>
                  {e.branches && (
                    <span className="text-xs text-muted-foreground italic">
                      Filial: {getBranchDisplayName(e.branches)}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">{e.description}</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-muted rounded-full font-bold uppercase">
                      {e.type === "ativacao_matriz" ? "Matriz" : "Filial"}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {e.category}
                    </span>
                  </div>
                  {canManageInvestments && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setEditingExpense(e);
                          setSelectedCompanyId(e.company_id);
                          setSelectedBranchId(e.branch_id || "");
                          setSelectedType(e.type || "ativacao_matriz");
                          setSelectedCategory(e.category || "materiais");
                          setIsModalOpen(true);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm("Deseja realmente excluir este lançamento?")) {
                            deleteMutation.mutate(e.id);
                          }
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredExpenses.length === 0 && !statsQuery.isLoading && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhum gasto encontrado.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
