/**
 * API Route - Création depuis Template
 * POST /api/rules/templates/[id]/use - Crée une règle depuis un template
 */

import { NextRequest, NextResponse } from 'next/server';
import { RuleEngineService } from '@/lib/modules/rules/rule-engine-service';

const ruleEngineService = new RuleEngineService();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const templateId = id;
    const userId = 'current-user'; // TODO: Récupérer depuis session
    const userName = 'Current User'; // TODO: Récupérer depuis session
    const workspaceId = 'default'; // TODO: Récupérer depuis session

    const body = await request.json();

    // Validation
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Le nom de la règle est obligatoire',
        },
        { status: 400 }
      );
    }

    if (!body.conditionValues || typeof body.conditionValues !== 'object') {
      return NextResponse.json(
        {
          success: false,
          error: 'Les valeurs des conditions sont obligatoires',
        },
        { status: 400 }
      );
    }

    // Créer la règle depuis le template
    const newRule = await ruleEngineService.createRuleFromTemplate(
      templateId,
      body.name.trim(),
      body.conditionValues,
      workspaceId,
      userId,
      userName
    );

    // Mettre à jour les champs optionnels si fournis
    const updates: any = {};

    if (body.description) {
      updates.description = body.description.trim();
    }

    if (body.autoExecute !== undefined) {
      updates.autoExecute = body.autoExecute;
    }

    if (body.requiresApproval !== undefined) {
      updates.requiresApproval = body.requiresApproval;
    }

    if (body.priority !== undefined) {
      updates.priority = body.priority;
    }

    if (body.notifyOnMatch !== undefined) {
      updates.notifyOnMatch = body.notifyOnMatch;
    }

    if (body.notifyRoles) {
      updates.notifyRoles = body.notifyRoles;
    }

    // Appliquer les mises à jour si nécessaire
    let finalRule = newRule;
    if (Object.keys(updates).length > 0) {
      finalRule = await ruleEngineService.updateRule(newRule.RuleId, updates as any);
    }

    return NextResponse.json(
      {
        success: true,
        data: finalRule,
        message: 'Règle créée depuis template avec succès',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erreur création depuis template:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
