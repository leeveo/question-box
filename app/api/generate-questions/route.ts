import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
    try {
        const { companyContext } = await request.json();

        if (!companyContext || companyContext.trim().length === 0) {
            return NextResponse.json(
                { error: 'Le contexte est requis' },
                { status: 400 }
            );
        }

        // Détecte si c'est un prompt de catégorie (contient "instructions" ou "actions directes")
        const isCategoryPrompt = companyContext.includes('instructions') || companyContext.includes('actions directes');

        let systemPrompt: string;
        let userPrompt: string;

        if (isCategoryPrompt) {
            // Prompt pour les catégories (actions/instructions)
            systemPrompt = 'Tu es un expert en création d\'instructions et d\'actions amusantes pour des vidéos interactives. Tu génères des actions directes à faire devant la caméra, JAMAIS des questions.';
            userPrompt = `${companyContext}

IMPORTANT: Retourne uniquement un tableau JSON de 8 strings (les instructions/actions), sans aucun texte supplémentaire.
Format attendu: ["Action 1", "Action 2", ...]
Les instructions doivent être IMPERATIVES (ex: "Danse un rock", "Fais une grimace") et NON des questions.`;
        } else {
            // Prompt pour le contexte entreprise (questions)
            systemPrompt = 'Tu es un expert en création de questions pour témoignages vidéo. Tu génères des questions réflexives et émotionnelles, jamais factuelles.';
            userPrompt = `Tu es un expert en création de questions pour recueillir des témoignages vidéo authentiques et émotionnels.

Contexte de l'entreprise: ${companyContext}

Génère exactement 8 questions personnelles et réflexives en français pour cette entreprise.

Les questions doivent:
- Être ouvertes et encourager la réflexion personnelle profonde
- Porter sur les sentiments, émotions, valeurs, et vision personnelle
- Éviter absolument les questions de connaissance factuelle
- Être adaptées au contexte de l'entreprise fourni
- Encourager des réponses authentiques et émotionnelles
- Utiliser le "vous" pour s'adresser à la personne

Exemples de types de questions à générer:
- "Comment voyez-vous l'entreprise dans 5 ans ?"
- "Quel mot définirait le mieux votre expérience ici ?"
- "Quelle valeur de l'entreprise résonne le plus avec vous ?"
- "Quel moment vous a le plus marqué dans votre parcours ?"

IMPORTANT: Retourne uniquement un tableau JSON de 8 strings (les questions), sans aucun texte supplémentaire.
Format attendu: ["Question 1?", "Question 2?", ...]`;
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            temperature: 0.8,
            max_tokens: 1000,
        });

        const responseText = completion.choices[0].message.content?.trim();

        if (!responseText) {
            throw new Error('Aucune réponse de l\'API OpenAI');
        }

        // Parse the JSON response
        let questions: string[];
        try {
            questions = JSON.parse(responseText);
        } catch (parseError) {
            // If direct parsing fails, try to extract JSON array from the response
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                questions = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Format de réponse invalide');
            }
        }

        // Validate that we got an array of strings
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Format de questions invalide');
        }

        // Ensure we have exactly 8 questions
        questions = questions.slice(0, 8);

        return NextResponse.json({ questions });

    } catch (error) {
        console.error('Error generating questions:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: `Erreur lors de la génération: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Une erreur est survenue lors de la génération des questions' },
            { status: 500 }
        );
    }
}
