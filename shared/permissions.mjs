// Stable action identifiers shared by the API and the administration interface.
export const roles = { almoxarifado: 'Almoxarifado', engenharia: 'Engenharia', suprimentos: 'Suprimentos', diretor: 'Diretor de engenharia' };
export const capabilities = {
  create: 'Criar solicitações', edit: 'Revisar solicitações antes da emissão',
  engineering: 'Validar necessidade e orçamento', rejectEngineering: 'Devolver na conferência técnica',
  quote: 'Cadastrar propostas', suggest: 'Sugerir fornecedores', send: 'Enviar contratação ao diretor',
  director: 'Decidir fornecedores e aprovar contratação', rejectDirector: 'Devolver a suprimentos',
  arrival: 'Alterar previsão de chegada', receive: 'Registrar recebimentos', withdraw: 'Registrar saídas de estoque',
  measure: 'Registrar medições', material: 'Cadastrar materiais', supplier: 'Cadastrar e editar fornecedores',
  quoteFiles: 'Adicionar anexos a propostas existentes', orderFiles: 'Adicionar anexos aos pedidos',
};
export function can(actor, action, work) {
  return actor?.access?.some(a => (!work || a.work_id === work) && a.permissions?.includes(action)) || false;
}
