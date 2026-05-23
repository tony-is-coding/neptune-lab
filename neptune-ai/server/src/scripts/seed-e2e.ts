import bcrypt from 'bcrypt';
import {eq} from 'drizzle-orm';
import {db, tenants, users, agentTemplates} from '../db';

const E2E_USER = {
    email: 'e2e@neptune.ai',
    password: 'NeptuneE2E2026!',
    name: 'Neptune E2E',
};

const E2E_TENANT = {
    name: 'Neptune E2E',
};

const E2E_AGENT = {
    name: 'E2E Assistant',
    description: 'Deterministic assistant for browser acceptance.',
};

async function seed() {
    let tenant = await db.query.tenants.findFirst({
        where: eq(tenants.name, E2E_TENANT.name),
    });

    if (!tenant) {
        [tenant] = await db.insert(tenants).values(E2E_TENANT).returning();
    }

    const passwordHash = await bcrypt.hash(E2E_USER.password, 10);
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, E2E_USER.email),
    });

    const [user] = existingUser
        ? await db
            .update(users)
            .set({
                tenantId: tenant.id,
                name: E2E_USER.name,
                passwordHash,
                role: 'admin',
            })
            .where(eq(users.id, existingUser.id))
            .returning()
        : await db
            .insert(users)
            .values({
                tenantId: tenant.id,
                name: E2E_USER.name,
                email: E2E_USER.email,
                passwordHash,
                role: 'admin',
            })
            .returning();

    const existingAgent = await db.query.agentTemplates.findFirst({
        where: (table, {and, eq}) => and(
            eq(table.tenantId, tenant.id),
            eq(table.name, E2E_AGENT.name),
        ),
    });

    const agentValues = {
        tenantId: tenant.id,
        name: E2E_AGENT.name,
        description: E2E_AGENT.description,
        icon: 'smart_toy',
        systemPrompt: [
            'You are E2E Assistant.',
            'Reply concisely for local browser acceptance tests.',
        ].join('\n'),
        promptConfig: {
            identity: 'Deterministic assistant for local E2E acceptance.',
            disableGuard: true,
        },
        modelConfig: {
            provider: 'anthropic',
            model: process.env.NEPTUNE_LLM_MODEL || 'claude-sonnet-4-20250514',
            temperature: 0,
            maxTokens: 512,
        },
        tools: [],
        skills: [],
        mcpServers: [],
        constraints: {
            maxTokensPerTurn: 10000,
            maxTurnsPerSession: 20,
            maxConcurrentSessions: 5,
        },
        isActive: true,
    };

    const [agent] = existingAgent
        ? await db
            .update(agentTemplates)
            .set({...agentValues, updatedAt: new Date()})
            .where(eq(agentTemplates.id, existingAgent.id))
            .returning()
        : await db.insert(agentTemplates).values(agentValues).returning();

    console.log(JSON.stringify({
        tenant: {id: tenant.id, name: tenant.name},
        user: {id: user.id, email: user.email, role: user.role},
        agent: {id: agent.id, name: agent.name},
    }, null, 2));
}

seed()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
