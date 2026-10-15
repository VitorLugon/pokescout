export function CoverageHelp() {
  return <details className="coverage-help"><summary>Como interpretar cobertura e importação</summary>
    <p><strong>Cobertura da fonte:</strong> standings completos são o conjunto publicado pela fonte, sem certificação de resultado oficial. Resultados selecionados incluem apenas parte das colocações. Cobertura desconhecida não autoriza presumir completude.</p>
    <p><strong>Importação:</strong> descreve o que foi salvo localmente. Uma fonte pode publicar standings completos enquanto a importação tem listas pendentes ou outros dados ausentes. Isso não mede a completude da carreira.</p>
    <p><strong>Listas:</strong> um arquétipo conhecido não significa lista importada. Disponível na fonte pode estar pendente; falha de extração é outro estado. Uma lista anterior válida permanece consultável se uma atualização falhou.</p>
  </details>;
}
