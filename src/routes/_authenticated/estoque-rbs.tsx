import { createFileRoute } from "@tanstack/react-router";
import { RbInventory } from "@/components/app/rb-inventory";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAccess } from "@/hooks/use-access";

export const Route = createFileRoute("/_authenticated/estoque-rbs")({
  head: () => ({ meta: [{ title: "Estoque RBs | Manos Tech" }] }),
  component: RbInventoryPage,
});

function RbInventoryPage() {
  const { data: access, isLoading } = useAccess();
  const canManageInventory = access?.role === "adm" || access?.role === "revenda";

  if (isLoading) {
    return <div className="container max-w-5xl py-10">Carregando estoque…</div>;
  }

  if (!canManageInventory) {
    return (
      <div className="container max-w-3xl py-10">
        <Card className="border-amber-400/30">
          <CardContent className="p-6">
            <PageHeader
              title="Acesso restrito"
              subtitle="O estoque e a transferência de RBs são exclusivos para administradores e revendas."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <PageHeader
        title="Estoque RBs"
        subtitle="Gerencie equipamentos disponíveis e transfira RBs entre clientes."
      />
      <RbInventory />
    </div>
  );
}
