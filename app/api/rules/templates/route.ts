/**
 * API Route - Templates de Règles
 * GET /api/rules/templates - Liste des templates de règles disponibles
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function GET(request: NextRequest) {
  try {
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    // Récupérer tous les templates
    const templates = await ruleEngineService.listRuleTemplates();

    // Organiser par catégorie
    const templatesByCategory = templates.reduce(
      (acc, template) => {
        const category = template.Category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(template);
        return acc;
      },
      {} as Record<string, typeof templates>
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          all: templates,
          byCategory: templatesByCategory,
          count: templates.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erreur récupération templates:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
