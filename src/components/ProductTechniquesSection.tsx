import React from 'react';
import { Material, Product } from '../types';
import { gradeMaterialOf, withMaterialGrade } from '../lib/materialGrade';
import { ProductGradeTechniques } from './ProductGradeTechniques';

/**
 * Item 32, entrega 2 (16/11/2026): produto com uma matéria-prima com grade na receita (ex.: Camiseta). A grade vem dela;
 * aqui ficam só as técnicas, com os tecidos e as cores que cada uma aceita.
 */
export function ProductTechniquesSection({
  newProduct,
  setNewProduct,
  materials,
}: {
  newProduct: Partial<Product>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  materials: Material[];
}) {
  // Grade antiga, no próprio produto: avisa e deixa tirar (a grade agora fica na matéria-prima).
  if (newProduct.grade?.fabrics?.length) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-2">
        <p>
          Este produto tem a grade antiga, no próprio produto. Agora a grade fica na matéria-prima: cadastre a
          "Camiseta" com grade, coloque-a na receita e tire a grade antiga.
        </p>
        <button
          type="button"
          onClick={() => setNewProduct(p => ({ ...p, grade: null }))}
          className="px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-amber-900 hover:bg-amber-100"
        >
          Tirar a grade antiga
        </button>
      </div>
    );
  }
  const grade = withMaterialGrade(newProduct, materials).grade;
  const parent = gradeMaterialOf(newProduct, materials);
  if (!grade || !parent) return null;

  return (
    <div className="space-y-3 pt-2 border-t border-neutral-100">
      <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Técnicas</label>
      <p className="text-xs text-neutral-500">
        A grade vem da matéria-prima "{parent.name}" ({grade.fabrics.length} tecido(s), {grade.sizes.length} tamanho(s),{' '}
        {grade.colors.length} cor(es)). No orçamento você escolhe tecido, cor, tamanho e técnica.
      </p>
      <ProductGradeTechniques
        grade={grade}
        update={next => setNewProduct(p => ({ ...p, techniques: next.techniques ?? [] }))}
        materials={materials}
      />
    </div>
  );
}
