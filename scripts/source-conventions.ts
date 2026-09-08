import ts from 'typescript-parser';

export function mutableDeclarations(file: string, source: string): string[] {
  if (
    !/^(apps|packages)\/[^/]+\/src\/.*\.[cm]?[jt]sx?$/.test(file) ||
    /\.spec\.[cm]?[jt]sx?$/.test(file) ||
    /\.d\.[cm]?ts$/.test(file) ||
    /^apps\/web\/src\/components\/ui\/[^/]+\.tsx$/.test(file)
  )
    return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclarationList(node)) {
      const token = node.getFirstToken(ast);
      if (
        token &&
        (token.kind === ts.SyntaxKind.LetKeyword ||
          token.kind === ts.SyntaxKind.VarKeyword)
      ) {
        const { line, character } = ast.getLineAndCharacterOfPosition(
          token.getStart(ast),
        );
        violations.push(
          `${file}:${line + 1}:${character + 1}: Use const and explicit results instead of let/var.`,
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return violations;
}
