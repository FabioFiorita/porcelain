import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  commentsAt,
  nodeCommentCounts,
} from '@porcelain/client/comments/rules';
import {
  diagramConnections,
  diagramEdgeTone,
  diagramNeighbours,
  diagramNodeDescription,
  diagramNodeFacts,
  diagramNodeSign,
  layoutDiagram,
  type DiagramNode,
  type StepDiagram,
  type WalkthroughRun,
} from '@porcelain/client/walkthroughs/rules';
import { Box } from '../../../components/ui/box';
import { Button } from '../../../components/ui/button';
import {
  Diagram,
  diagramMeasure,
  type DiagramCard,
  type DiagramLine,
} from '../../../components/ui/diagram';
import { Text } from '../../../components/ui/text';
import { DraftComments, newCommentParams, useComments } from '../../comments';
import type { Workspace } from '../../projects/index';
import { useChangedFileOpening } from './changed-file-opening';
import { CapturedExcerpt } from './walkthrough-excerpt';

function NodeFile({ workspace, path }: { workspace: Workspace; path: string }) {
  const opening = useChangedFileOpening(workspace);
  const row = opening.row(path);
  return (
    <Box gap={1}>
      <Box className="flex-row items-center" gap={2}>
        <Text variant="mono" tone="muted" className="min-w-0 flex-1">
          {path}
        </Text>
        <Button
          label="Open file"
          variant="plain"
          size="sm"
          pending={row.pending}
          disabled={row.disabled}
          onPress={row.onPress}
        />
      </Box>
      {opening.failure}
    </Box>
  );
}

function NodeDetail({
  workspace,
  run,
  step,
  title,
  diagram,
  node,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  step: number;
  title: string;
  diagram: StepDiagram;
  node: DiagramNode;
}) {
  const router = useRouter();
  const { view } = useComments(workspace);
  const drafts = commentsAt(
    view,
    (anchor) =>
      anchor.kind === 'node' &&
      anchor.title === title &&
      anchor.node === node.label,
  );
  const facts = diagramNodeFacts(node);
  const connections = diagramConnections(diagram, node.id);
  return (
    <Box gap={2} accessibilityLiveRegion="polite">
      <Text
        variant={node.kind === 'external' ? 'secondary' : 'code'}
        weight="medium"
      >
        {node.label}
      </Text>
      {facts || node.note ? (
        <Text variant="secondary" tone="muted">
          {[facts, node.note].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {connections.map((connection) => (
        <Text key={connection} variant="caption" tone="muted">
          {connection}
        </Text>
      ))}
      {node.anchor?.kind === 'lines' ? (
        <CapturedExcerpt
          workspace={workspace}
          runId={run.id}
          step={step}
          excerpt={node.anchor.excerpt}
        />
      ) : null}
      {node.anchor?.kind === 'file' ? (
        <NodeFile workspace={workspace} path={node.anchor.path} />
      ) : null}
      <DraftComments workspace={workspace} drafts={drafts} />
      <Button
        label={`Comment on ${node.label}`}
        variant="plain"
        size="sm"
        align="start"
        className="-ml-3.5 self-start"
        onPress={() =>
          router.push({
            pathname: '/comment',
            params: newCommentParams(workspace.key, {
              kind: 'node',
              title,
              node: node.label,
            }),
          })
        }
      />
    </Box>
  );
}

export function WalkthroughDiagram({
  workspace,
  run,
  step,
  title,
  diagram,
}: {
  workspace: Workspace;
  run: WalkthroughRun;
  step: number;
  title: string;
  diagram: StepDiagram;
}) {
  const [width, setWidth] = useState(0);
  const [chosen, setChosen] = useState<string>();
  const { view } = useComments(workspace);
  const geometry = layoutDiagram(
    diagram,
    diagramMeasure,
    width === 0 ? Infinity : width,
  );
  const counts = nodeCommentCounts(view, title);
  const near =
    chosen === undefined ? undefined : diagramNeighbours(diagram, chosen);
  const cards: DiagramCard[] = diagram.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    note: node.note,
    sign: diagramNodeSign(node),
    mark: node.mark,
    code: node.kind !== 'external',
    comments: counts.get(node.label) ?? 0,
    description: diagramNodeDescription(diagram, node),
  }));
  const lines: DiagramLine[] = diagram.edges.map((edge, index) => ({
    index,
    tone: diagramEdgeTone(edge, near?.edges.has(index) === true),
    dashed: edge.mark === 'removed',
    label: edge.label,
  }));
  const chosenNode = diagram.nodes.find((node) => node.id === chosen);
  return (
    <Box gap={3}>
      <Diagram
        title={diagram.title}
        geometry={geometry}
        cards={cards}
        lines={lines}
        selected={chosen}
        near={near}
        onSelect={(id) => setChosen(chosen === id ? undefined : id)}
        onWidth={(next) => {
          if (Math.round(next) !== Math.round(width)) setWidth(next);
        }}
      />
      {chosenNode ? (
        <NodeDetail
          key={chosenNode.id}
          workspace={workspace}
          run={run}
          step={step}
          title={title}
          diagram={diagram}
          node={chosenNode}
        />
      ) : null}
    </Box>
  );
}
