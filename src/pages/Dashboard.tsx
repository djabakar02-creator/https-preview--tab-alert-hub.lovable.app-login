import { Link, useNavigate } from "react-router-dom";
import { useUser } from "../App";
import { formatDateFR } from "../lib/dates";
import { delaiDuDossier } from "../lib/delais";
import { useDossiers } from "../lib/dossiers";
import { Empty, NiveauBadge, Section, StatutBadge } from "../components/ui";

export default function Dashboard() {
  const user = useUser();
  const dossiers = useDossiers();
  const navigate = useNavigate();

  const enCours = dossiers.filter((d) => d.statut === "en_instruction" || d.statut === "en_attente_pieces");
  const calc = enCours.map((d) => ({ d, c: delaiDuDossier(d) }));
  /* Un analyste ne pilote que ses propres dossiers ; les autres profils voient tout. */
  const mesEnCours = user.role === "analyste" ? calc.filter((x) => x.d.analyste === user.username) : calc;
  /* Les indicateurs portent sur tout le service. Chaque lien force donc
     « analyste=__tous », sinon un analyste verrait un registre restreint à ses
     dossiers, en contradiction avec le nombre affiché sur la tuile. */
  const kpis = [
    { label: "Dossiers au registre", value: dossiers.length, to: "/registre?analyste=__tous" },
    { label: "En cours", value: enCours.length, to: "/registre?analyste=__tous&statut=en_cours" },
    {
      label: "Urgents (≤ 3 j)",
      value: calc.filter((x) => x.c.niveau === "urgent").length,
      to: "/registre?analyste=__tous&niveau=urgent",
      rouge: true,
    },
    {
      label: "Délai dépassé",
      value: calc.filter((x) => x.c.niveau === "depasse").length,
      to: "/registre?analyste=__tous&niveau=depasse",
      rouge: true,
    },
    ...(user.role === "analyste"
      ? [{ label: "Mes dossiers en cours", value: mesEnCours.length, to: "/registre?analyste=__mine&statut=en_cours" }]
      : [{ label: "Non attribués", value: enCours.filter((d) => !d.analyste).length, to: "/registre?analyste=__none" }]),
  ];
  const prioritaires = [...mesEnCours].sort((a, b) => a.c.delaiRestant - b.c.delaiRestant).slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <p className="label-caps text-rouge mb-1">Tableau de bord</p>
        <h1 className="font-display text-3xl">Situation du registre</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="card p-4 hover:border-rouge transition block">
            <p className="label-caps text-[10px] opacity-70">{k.label}</p>
            <p className={`font-display text-4xl mt-2 ${k.rouge && k.value > 0 ? "text-rouge" : ""}`}>{k.value}</p>
          </Link>
        ))}
      </div>

      <Section
        title={user.role === "analyste" ? "Mes dossiers prioritaires" : "Dossiers prioritaires"}
        aside={
          <button type="button" className="btn-sm" onClick={() => navigate("/registre")}>
            Voir tout
          </button>
        }
      >
        {prioritaires.length === 0 ? (
          <Empty>Aucun dossier en cours.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left label-caps text-[10px] border-b border-line">
                  <th className="py-2 pr-4">Référence</th>
                  <th className="py-2 pr-4">Demandeur</th>
                  <th className="py-2 pr-4">Réception</th>
                  <th className="py-2 pr-4">Écoulé</th>
                  <th className="py-2 pr-4">Restant</th>
                  <th className="py-2 pr-4">Niveau</th>
                  <th className="py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {prioritaires.map(({ d, c }) => (
                  <tr key={d.id} className="border-b border-ink/10 hover:bg-sand/60 cursor-pointer" onClick={() => navigate(`/registre/${d.id}`)}>
                    <td className="py-2.5 pr-4 font-mono text-xs">{d.reference}</td>
                    <td className="py-2.5 pr-4 font-semibold">{d.demandeur}</td>
                    <td className="py-2.5 pr-4">{formatDateFR(d.dateReception)}</td>
                    <td className="py-2.5 pr-4 tabular-nums">J+{c.joursEcoules}</td>
                    <td className="py-2.5 pr-4 tabular-nums font-bold">{c.delaiRestant} j</td>
                    <td className="py-2.5 pr-4">
                      <NiveauBadge niveau={c.niveau} />
                    </td>
                    <td className="py-2.5">
                      <StatutBadge statut={d.statut} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
