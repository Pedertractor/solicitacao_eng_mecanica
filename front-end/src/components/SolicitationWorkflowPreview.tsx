import { ArrowDown, Check, ClipboardList, Compass, Flag, GitBranch, Layers3, ShieldCheck, Sparkles, UsersRound, Wrench, FlaskConical } from 'lucide-react';
import { buildSolicitationPreview, type PreviewNode, type SolicitationRoute } from '@/config/solicitation-routing';

const icons = { engineering: Compass, pcp: ClipboardList, tooling: Wrench, quality: ShieldCheck, sample: FlaskConical };

function FlowNode({ node }: { node: PreviewNode }) {
  const Icon = icons[node.kind];
  return <div className={`solicitation-flow-node solicitation-flow-node-${node.kind}`}>
    <span className='solicitation-flow-icon'><Icon size={17} aria-hidden /></span>
    <span><strong>{node.label}</strong><small>{node.description}</small></span>
  </div>;
}

function FlowArrow() {
  return <span className='solicitation-flow-arrow' aria-hidden><ArrowDown size={13} /></span>;
}

export function SolicitationWorkflowPreview({ route }: { route: SolicitationRoute }) {
  const preview = buildSolicitationPreview(route);
  const parallel = preview.mode === 'sample';
  return (
    <aside className='solicitation-preview' aria-labelledby='workflow-preview-title'>
      <div className='solicitation-preview-heading'><span><GitBranch size={16} aria-hidden /> O CAMINHO DO SEU CHAMADO</span>
        <span className='solicitation-preview-live'><span /> Ao vivo</span></div>
      <h2 id='workflow-preview-title'>{preview.title}</h2>
      <p className='solicitation-preview-intro'>{preview.description}</p>
      <div className='solicitation-preview-canvas' aria-live='polite' aria-atomic='true'>
        {preview.mode === 'unconfigured' ? (
          <div className='solicitation-flow-empty'>
            <span className='solicitation-flow-empty-orbit'><GitBranch size={31} aria-hidden /></span>
            <div className='solicitation-flow-placeholder'><UsersRound size={17} aria-hidden /> Departamento solicitante</div>
            <FlowArrow />
            <div className='solicitation-flow-placeholder'><Compass size={17} aria-hidden /> Equipe de destino</div>
            <p>Seu fluxo aparece aqui.</p>
          </div>
        ) : (
          <div className='solicitation-flow' key={`${route.destination}-${route.requester}-${preview.mode}-${route.requiresTooling}`}>
            <div className='solicitation-flow-origin'><UsersRound size={17} aria-hidden /><span><small>DEPARTAMENTO SOLICITANTE</small><strong>{route.requester}</strong></span><span className='solicitation-flow-start-dot' /></div>
            <FlowArrow />
            {parallel && <div className='solicitation-flow-parallel-label'><Layers3 size={13} aria-hidden /> Frentes em paralelo</div>}
            <div className={`solicitation-flow-lanes ${parallel ? 'solicitation-flow-lanes-parallel' : ''}`} data-lanes={preview.lanes.length} style={{ gridTemplateColumns: `repeat(${preview.lanes.length}, minmax(0, 1fr))` }}>
              {preview.lanes.map((nodes, index) => (
                <div className='solicitation-flow-lane' key={index}>
                  {nodes.map((node, nodeIndex) => <div className='solicitation-flow-lane-item' key={`${node.kind}-${nodeIndex}`}><FlowNode node={node} />{nodeIndex < nodes.length - 1 && <FlowArrow />}</div>)}
                </div>
              ))}
            </div>
            {parallel && <><div className='solicitation-flow-join' style={{ marginInline: `${50 / preview.lanes.length}%` }} aria-hidden /><div className='solicitation-flow-join-label'>Todas as frentes se encontram aqui</div><FlowNode node={{ kind: 'sample', label: 'Amostra', description: 'Execução da amostra' }} /></>}
            <FlowArrow />
            <div className='solicitation-flow-finish'><span><Check size={14} aria-hidden /></span> Solicitação concluída <Flag size={13} aria-hidden /></div>
          </div>
        )}
      </div>
      <div className='solicitation-preview-note'><Sparkles size={16} aria-hidden /><p>A prévia acompanha suas escolhas. Você pode voltar e ajustar o caminho antes de enviar.</p></div>
    </aside>
  );
}
