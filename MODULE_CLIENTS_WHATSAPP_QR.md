# 📱 MODULE CLIENTS - CAPTURE ULTRA-RAPIDE & WHATSAPP

## 🎯 Vue d'Ensemble

Cette documentation couvre les **nouvelles fonctionnalités ultra-rapides** ajoutées au module Clients & Fidélité :

1. **Ajout Client Express** (< 5 secondes)
2. **QR Code Auto-Enregistrement** (0 seconde commerçant)
3. **WhatsApp Business API Integration**

**Objectif** : "Embarquer un client en un click" avec automatisation maximale.

---

## 🚀 FONCTIONNALITÉ 1 : AJOUT CLIENT EXPRESS

### Concept

Page dédiée pour capturer un client en **moins de 5 secondes** avec juste son numéro de téléphone.

### Route
`/customers/quick`

### Caractéristiques

#### Input Téléphone Géant
- **Taille** : `h-20` (80px), `text-4xl` (36px)
- **Border** : `border-4` violet/purple
- **Auto-focus** : Focus automatique au chargement
- **Format auto** : +225 XX XX XX XX XX

#### Boutons Opérateurs Rapides
4 boutons en grille 2×2 pour pré-remplir le numéro :
- 🟠 **Orange** : +225 01
- 🟡 **MTN** : +225 05
- 🔵 **Moov** : +225 07
- 🟢 **Fixe** : +225 27

**Effet** : Clic sur opérateur = numéro pré-rempli, utilisateur tape juste les 8 derniers chiffres.

#### Champ Nom Optionnel
- Affiché mais **non obligatoire**
- Si vide : nom auto-généré = `"Client {4 derniers chiffres}"`
- Exemple : `"Client 6789"`

#### Actions Automatiques (Checkboxes)
Deux checkboxes **cochées par défaut** :
- ✅ **Envoyer message WhatsApp de bienvenue**
- ✅ **Donner 500 points de bienvenue**

L'utilisateur peut décocher si besoin, mais par défaut = activation.

#### Workflow

```
1. Page charge → Focus auto sur input téléphone
2. User clique bouton "Orange" → +225 01 pré-rempli
3. User tape 23456789 → Formatage auto : +225 01 23 45 67 89
4. User clique "Enregistrer" (bouton géant gradient)
5. API POST /api/customers/quick
   ├─ Création client
   ├─ Envoi WhatsApp (si coché)
   └─ Ajout 500 points (si coché)
6. Écran de succès (2 secondes)
7. Redirection automatique vers fiche client
```

**Temps total** : < 5 secondes

### Fichier Source

**Page** : `app/customers/quick/page.tsx` (~400 lignes)

**Composants clés** :
```tsx
// Input téléphone géant
<input
  type="tel"
  value={phone}
  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
  autoFocus
  className="w-full h-20 px-6 text-4xl text-center font-bold border-4 border-purple-600 rounded-2xl"
  placeholder="+225 XX XX XX XX XX"
/>

// Boutons opérateurs
<button
  onClick={() => setPhone(formatPhoneNumber('225 01'))}
  className="h-16 bg-orange-500 text-white"
>
  <Phone className="w-6 h-6" />
  Orange (01)
</button>

// Actions automatiques
<input
  type="checkbox"
  checked={sendWelcomeWhatsApp}
  onChange={(e) => setSendWelcomeWhatsApp(e.target.checked)}
  className="w-6 h-6"
/>
<label>Envoyer message WhatsApp de bienvenue</label>
```

### API Route

**Endpoint** : `POST /api/customers/quick`

**Fichier** : `app/api/customers/quick/route.ts`

**Body** :
```json
{
  "phone": "0123456789",
  "fullName": "Jean Dupont",
  "sendWelcomeWhatsApp": true,
  "giveWelcomeBonus": true,
  "workspaceId": "default"
}
```

**Logique** :
1. **Validation** : Téléphone obligatoire
2. **Nettoyage** : `phone.replace(/\D/g, '')` (garde seulement chiffres)
3. **Check doublon** : `customerService.findByPhone()`
   - Si existe → Retour 409 Conflict avec `customerId`
4. **Création** : `customerService.create()`
   - Status : `active`
   - Tier : `bronze`
   - Source : `quick_add`
5. **WhatsApp** (si activé) :
   - Appel `whatsappService.sendWelcomeMessage()`
   - Si succès → Mise à jour `LastWhatsAppDate`
   - Si erreur → Non bloquant, continuer
6. **Bonus** (si activé) :
   - Appel `loyaltyService.addPoints(500, 'welcome_bonus')`
   - Mise à jour `LoyaltyPoints = 500`
   - Si erreur → Non bloquant, continuer
7. **Retour** :
```json
{
  "success": true,
  "message": "Client créé avec succès",
  "data": {
    "customer": { /* ... */ },
    "whatsappSent": true,
    "bonusAdded": true,
    "whatsappError": null,
    "bonusError": null
  }
}
```

### Performance

**Cible** : < 5 secondes de bout en bout

**Optimisations** :
- Input téléphone avec formatage client-side (pas d'API call)
- Boutons opérateurs = simple pré-remplissage (instant)
- Validation en temps réel (feedback immédiat)
- Actions WhatsApp/Bonus en **parallèle** (non séquentielles)
- Redirection automatique après succès (pas d'attente)

---

## 🔲 FONCTIONNALITÉ 2 : QR CODE AUTO-ENREGISTREMENT

### Concept

Le client **scanne un QR Code** et **s'enregistre lui-même** sur son téléphone.

**Avantages** :
- ✅ **Zéro temps commerçant** (0 seconde)
- ✅ Client contrôle ses données partagées
- ✅ Plus fluide et moderne
- ✅ Traçabilité stand/agent automatique

### Route
`/customers/qr-register`

### Workflow en 3 Étapes

#### Étape 1 : Affichage QR (Vue Commerçant)

**Condition** : Pas de paramètres URL → `step = 'qr'`

**Affichage** :
- Titre : "QR Code Client"
- QR Code généré avec URL encodée
- URL format : `/customers/qr-register?stand=X&standName=Y&agent=Z&agentName=W`
- Instructions en 3 étapes numérotées
- Section "Avantages" avec 4 checkmarks

**Génération URL** :
```typescript
function generateQRCodeURL(): string {
  const baseURL = window.location.origin;
  const params = new URLSearchParams({
    stand: standId || 'default',
    standName: standName || 'Stand DDM',
    agent: agentId || '',
    agentName: agentName || '',
  });
  return `${baseURL}/customers/qr-register?${params.toString()}`;
}
```

**TODO** : Intégrer librairie `qrcode.react` pour générer vraiment le QR Code.

```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={generateQRCodeURL()}
  size={256}
  level="H"
  includeMargin={true}
/>
```

#### Étape 2 : Formulaire Client (Vue Client)

**Condition** : Paramètres `?stand=X` présents → `step = 'form'`

**Header** :
- Titre : "Bienvenue !"
- Sous-titre : "Enregistrez-vous et recevez **500 points** de bienvenue"
- Info stand/agent si fournie : "📍 Stand Central • Agent Marie"

**Champs** :

1. **Téléphone** (OBLIGATOIRE) :
   - Input géant : `h-14`, `text-lg`, `border-2 purple-600`
   - Placeholder : `+225 01 23 45 67 89`
   - Auto-focus
   - Marqué avec `*` rouge

2. **Nom complet** (Optionnel) :
   - 2 inputs côte à côte (grid 2 cols)
   - Prénom | Nom
   - Border grise (pas obligatoire)

3. **Email et Ville** (Optionnels) :
   - 2 inputs empilés
   - Icônes Mail et MapPin

4. **Préférences** :
   - Checkbox "Recevoir les promotions par WhatsApp"
   - Default : **coché**
   - Style : Border verte si coché, grise sinon

**Card Cadeau** :
- Gradient purple→pink
- Icône Gift
- "Cadeau de bienvenue : 500 points offerts"

**Bouton Validation** :
- Géant : `h-16`, `text-xl`
- Gradient purple→pink
- Disabled si téléphone vide
- Loading state si soumission en cours

#### Étape 3 : Succès

**Condition** : Après soumission réussie → `step = 'success'`

**Affichage** :
- Checkmark vert géant (w-24 h-24)
- Titre : "Merci !"
- Sous-titre : "Vous êtes maintenant enregistré"
- Card blanche :
  - 🎁 Gift icon
  - "500 points ajoutés à votre compte"
  - Si WhatsApp : "✅ Vous allez recevoir un message WhatsApp de confirmation"
- Message final : "À bientôt ! 👋"

### Fichier Source

**Page** : `app/customers/qr-register/page.tsx` (~450 lignes)

**States** :
```tsx
const [step, setStep] = useState<'qr' | 'form' | 'success'>('qr');
const [standId, setStandId] = useState<string | null>(null);
const [standName, setStandName] = useState<string | null>(null);
const [agentId, setAgentId] = useState<string | null>(null);
const [phone, setPhone] = useState('');
const [firstName, setFirstName] = useState('');
const [lastName, setLastName] = useState('');
const [email, setEmail] = useState('');
const [city, setCity] = useState('');
const [receiveWhatsApp, setReceiveWhatsApp] = useState(true);
```

**useEffect pour détecter scan QR** :
```tsx
useEffect(() => {
  const stand = searchParams.get('stand');
  if (stand) {
    setStandId(stand);
    setStandName(searchParams.get('standName'));
    setAgentId(searchParams.get('agent'));
    setAgentName(searchParams.get('agentName'));
    setStep('form'); // Passer directement au formulaire
  }
}, [searchParams]);
```

**Soumission** :
```tsx
async function handleSubmit() {
  const response = await fetch('/api/customers/qr-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: phone.replace(/\D/g, ''),
      firstName,
      lastName,
      email,
      city,
      receiveWhatsApp,
      standId,
      agentId,
      source: 'qr_self_registration',
    }),
  });

  if (!response.ok) {
    throw new Error('Erreur lors de l\'enregistrement');
  }

  setStep('success');
}
```

### API Route

**Endpoint** : `POST /api/customers/qr-register`

**Fichier** : `app/api/customers/qr-register/route.ts`

**Body** :
```json
{
  "phone": "0123456789",
  "firstName": "Jean",
  "lastName": "Dupont",
  "email": "jean@example.com",
  "city": "Abidjan",
  "receiveWhatsApp": true,
  "standId": "stand_001",
  "agentId": "agent_042",
  "source": "qr_self_registration",
  "workspaceId": "default"
}
```

**Logique** :

1. **Validation** : Téléphone obligatoire

2. **Check si client existe déjà** :
   ```typescript
   const existingCustomer = await customerService.findByPhone(workspaceId, cleanedPhone);
   ```

3. **Si existe** :
   - Mettre à jour infos manquantes (prénom, nom, email, ville)
   - Envoyer WhatsApp quand même si demandé
   - Retour avec `isNew = false`

4. **Si nouveau** :
   - Construire `fullName = "${firstName} ${lastName}".trim()`
   - Si vide : `"Client {4 derniers chiffres}"`
   - Créer avec :
     - Status : `active`
     - Tier : `bronze`
     - Source : `qr_self_registration`
     - Tags : `["stand_{standId}"]` pour traçabilité
     - ReferredBy : `agentId` pour commission éventuelle
     - PreferredContactMethod : `whatsapp` si `receiveWhatsApp = true`

5. **Actions automatiques** :
   - **WhatsApp** (si `receiveWhatsApp = true` ET configuré) :
     - Appel `whatsappService.sendWelcomeMessage()`
     - Mise à jour `LastWhatsAppDate`
   - **Bonus** (TOUJOURS, même sans WhatsApp) :
     - Ajout 500 points
     - Transaction loyalty avec raison `welcome_bonus`
     - Description : "Bonus de bienvenue auto-enregistrement"

6. **Retour** :
```json
{
  "success": true,
  "message": "Client enregistré avec succès",
  "data": {
    "customer": { /* ... */ },
    "isNew": true,
    "whatsappSent": true,
    "bonusAdded": true,
    "whatsappError": null,
    "bonusError": null
  }
}
```

### Traçabilité Stand/Agent

**Intérêt** :
- Savoir quel stand a capturé quel client
- Rémunérer les agents performants
- Analyser efficacité des points de vente

**Implémentation** :
- `Customer.Tags` : `["stand_001", "campaign_2024_11"]`
- `Customer.ReferredBy` : `agent_042` (ID de l'agent)

**Exploitation future** :
```typescript
// Clients capturés par un stand
const clients = await customerService.list(workspaceId, {
  tags: ['stand_001']
});

// Commission agent
const clientsReferred = await customerService.list(workspaceId, {
  referredBy: 'agent_042'
});
const commission = clientsReferred.reduce((sum, c) => sum + c.TotalSpent, 0) * 0.05; // 5%
```

---

## 💬 FONCTIONNALITÉ 3 : WHATSAPP BUSINESS API

### Concept

Intégration complète avec WhatsApp Business API pour envoyer automatiquement :
- Messages de bienvenue
- Factures
- Confirmations de paiement
- Promotions personnalisées
- Notifications de points

### Configuration

**Variables d'Environnement** (`.env.local`) :
```env
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_API_KEY=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
```

**Setup** :
1. Créer compte [Meta Business](https://business.facebook.com/)
2. Créer app WhatsApp Business
3. Obtenir access token (long-lived)
4. Enregistrer numéro de téléphone
5. Vérifier le numéro

**Test configuration** :
```typescript
import { whatsappService } from '@/lib/whatsapp/whatsapp-service';

if (whatsappService.isConfigured()) {
  console.log('✅ WhatsApp configuré');
} else {
  console.log('❌ WhatsApp non configuré');
}
```

### Service WhatsApp

**Fichier** : `lib/whatsapp/whatsapp-service.ts` (~550 lignes)

**Classe** : `WhatsAppService`

#### Méthodes Principales

##### 1. Message de Bienvenue
```typescript
await whatsappService.sendWelcomeMessage(
  phone: string,
  customerName?: string,
  bonusPoints?: number
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Message envoyé** :
```
Bonjour [Nom] ! 🎉

Bienvenue chez DDM ! Nous sommes ravis de vous compter parmi nos clients.

🎁 **Cadeau de bienvenue**
Vous venez de recevoir **500 points** sur votre compte fidélité !

💎 **Vos avantages**
• Cumulez des points à chaque achat
• Profitez de réductions exclusives
• Recevez nos offres spéciales en avant-première

📱 Pour consulter vos points et profiter de vos avantages, contactez-nous à tout moment.

À très bientôt ! 🙏
```

**Appel** :
```typescript
const result = await whatsappService.sendWelcomeMessage(
  '+2250123456789',
  'Jean Dupont',
  500
);

if (result.success) {
  console.log('Message envoyé, ID:', result.messageId);
} else {
  console.error('Erreur:', result.error);
}
```

##### 2. Facture par WhatsApp
```typescript
await whatsappService.sendInvoice(
  phone: string,
  customerName: string,
  invoiceNumber: string,
  amount: number,
  itemsSummary: string,
  invoicePdfUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Message envoyé** :
```
Bonjour [Nom],

Merci pour votre achat ! 🛍️

📄 **Facture N° INV-202411-0042**
💰 Montant: 15 000 F CFA

• 2x Jus d'Orange 1L - 3 000 F
• 1x Bissap 2L - 2 500 F
• 3x Gingembre 1L - 9 500 F

📥 Votre facture détaillée est disponible ci-dessous.

Merci de votre confiance ! 🙏
```

Si `invoicePdfUrl` fourni, le PDF est envoyé en pièce jointe.

**Appel** :
```typescript
const itemsSummary = `
• 2x Jus d'Orange 1L - 3 000 F
• 1x Bissap 2L - 2 500 F
• 3x Gingembre 1L - 9 500 F
`;

await whatsappService.sendInvoice(
  customer.Phone,
  customer.FullName,
  'INV-202411-0042',
  15000,
  itemsSummary,
  'https://example.com/invoices/INV-202411-0042.pdf'
);
```

##### 3. Confirmation de Paiement
```typescript
await whatsappService.sendPaymentConfirmation(
  phone: string,
  customerName: string,
  amount: number,
  paymentMethod: string,
  newBalance?: number
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Message envoyé** :
```
Bonjour [Nom],

✅ **Paiement confirmé**

Nous avons bien reçu votre paiement de **15 000 F CFA** par Orange Money.

💳 Nouveau solde: 0 F CFA

Merci ! 🙏
```

**Appel** :
```typescript
await whatsappService.sendPaymentConfirmation(
  customer.Phone,
  customer.FullName,
  15000,
  'Orange Money',
  0
);
```

##### 4. Promotion Personnalisée
```typescript
await whatsappService.sendPromotion(
  phone: string,
  customerName: string,
  promoTitle: string,
  promoDescription: string,
  validUntil?: string,
  imageUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Message envoyé** :
```
Bonjour [Nom] ! 🎁

**OFFRE SPÉCIALE CLIENT VIP**

Profitez de -20% sur tous nos jus naturels ce week-end !

⏰ Valable jusqu'au dimanche 17/11

Ne manquez pas cette opportunité ! 🚀
```

Si `imageUrl` fourni, l'image est envoyée avec le message en caption.

**Appel** :
```typescript
await whatsappService.sendPromotion(
  customer.Phone,
  customer.FullName,
  'OFFRE SPÉCIALE CLIENT VIP',
  'Profitez de -20% sur tous nos jus naturels ce week-end !',
  'dimanche 17/11',
  'https://example.com/promo-weekend.jpg'
);
```

##### 5. Mise à Jour Fidélité
```typescript
await whatsappService.sendLoyaltyUpdate(
  phone: string,
  customerName: string,
  pointsEarned: number,
  totalPoints: number,
  tier?: string
): Promise<{ success: boolean; messageId?: string; error?: string }>
```

**Message envoyé** :
```
Bravo [Nom] ! 🎉

Vous venez de gagner **+150 points** !

💎 Total: **2 350 points**
🥈 Niveau: **SILVER**

Continuez à cumuler des points pour débloquer encore plus d'avantages ! 🚀
```

**Appel** :
```typescript
await whatsappService.sendLoyaltyUpdate(
  customer.Phone,
  customer.FullName,
  150,
  2350,
  'silver'
);
```

##### 6. Message de Test
```typescript
await whatsappService.sendTestMessage(
  phone: string
): Promise<{ success: boolean; error?: string }>
```

**Message envoyé** :
```
🧪 **Message de test DDM**

Ceci est un message de test pour vérifier la configuration WhatsApp.

✅ Configuration OK
📱 WhatsApp Business API opérationnel

Date: 15/11/2024 02:45:32
```

**Appel** :
```typescript
const result = await whatsappService.sendTestMessage('+2250123456789');
if (result.success) {
  console.log('✅ WhatsApp fonctionne !');
} else {
  console.error('❌ Erreur:', result.error);
}
```

#### Méthodes Internes (API Calls)

##### sendTextMessage()
Envoie un message texte simple via WhatsApp Business API.

**Payload** :
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2250123456789",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Message content here"
  }
}
```

##### sendImage()
Envoie une image avec caption optionnel.

**Payload** :
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2250123456789",
  "type": "image",
  "image": {
    "link": "https://example.com/image.jpg",
    "caption": "Caption text here"
  }
}
```

##### sendDocument()
Envoie un document (PDF, etc.).

**Payload** :
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2250123456789",
  "type": "document",
  "document": {
    "link": "https://example.com/document.pdf",
    "filename": "Invoice_001.pdf"
  }
}
```

##### sendTemplate()
Envoie un template message pré-approuvé par Meta.

**Payload** :
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "2250123456789",
  "type": "template",
  "template": {
    "name": "welcome_message",
    "language": {
      "code": "fr"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Jean Dupont" },
          { "type": "text", "text": "500" }
        ]
      }
    ]
  }
}
```

#### Utilities

##### formatPhoneNumber()
Formate un numéro de téléphone pour WhatsApp (seulement chiffres, avec 225).

```typescript
formatPhoneNumber('+225 01 23 45 67 89') → '2250123456789'
formatPhoneNumber('01 23 45 67 89') → '2250123456789'
formatPhoneNumber('2250123456789') → '2250123456789'
```

##### formatAmount()
Formate un montant en français avec séparateurs de milliers.

```typescript
formatAmount(15000) → '15 000'
formatAmount(1500000) → '1 500 000'
```

##### getTierEmoji()
Retourne l'emoji correspondant au tier de fidélité.

```typescript
getTierEmoji('bronze') → '🥉'
getTierEmoji('silver') → '🥈'
getTierEmoji('gold') → '🥇'
getTierEmoji('platinum') → '💎'
getTierEmoji('diamond') → '💍'
```

### API Routes WhatsApp

#### POST `/api/whatsapp/send-welcome`

**Fichier** : `app/api/whatsapp/send-welcome/route.ts`

**Body** :
```json
{
  "phone": "0123456789",
  "customerName": "Jean Dupont",
  "customerId": "recXXX",
  "bonusPoints": 500,
  "workspaceId": "default"
}
```

**Logique** :
1. Validation téléphone
2. Vérification configuration (`whatsappService.isConfigured()`)
   - Si non configuré → Retour 503 Service Unavailable
3. Appel `whatsappService.sendWelcomeMessage()`
4. Si `customerId` fourni → Mise à jour `LastWhatsAppDate`
5. Retour résultat

**Response** :
```json
{
  "success": true,
  "message": "Message WhatsApp envoyé avec succès",
  "data": {
    "messageId": "wamid.HBgNMjI1MDU0NzE2ODk5OBUCABIYFjNFQjA5...",
    "phone": "2250123456789"
  }
}
```

**Gestion d'erreurs** :
- 400 : Téléphone manquant
- 503 : WhatsApp non configuré
- 500 : Erreur API WhatsApp

### Gestion d'Erreurs

**Principe** : Erreurs WhatsApp **non bloquantes**

Si envoi WhatsApp échoue :
- Client **est quand même créé**
- Bonus **est quand même ajouté**
- Retour avec flags : `whatsappSent: false`, `whatsappError: "..."`

**Exemple** :
```json
{
  "success": true,
  "message": "Client créé avec succès",
  "data": {
    "customer": { /* ... */ },
    "whatsappSent": false,
    "bonusAdded": true,
    "whatsappError": "WhatsApp API non configuré",
    "bonusError": null
  }
}
```

**Utilisateur voit** :
- Message de succès général
- Warning : "Message WhatsApp non envoyé (configuration manquante)"
- Suggestion : "Contactez le support pour configurer WhatsApp"

### Rate Limiting (Recommandé)

WhatsApp Business API a des limites :
- **Tier 1** : 1K messages/24h
- **Tier 2** : 10K messages/24h
- **Tier 3** : 100K messages/24h
- **Limite** : Montée automatique selon volume et qualité

**Implémentation recommandée** :
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 messages par minute
});

const { success } = await ratelimit.limit(phone);
if (!success) {
  return NextResponse.json(
    { error: 'Rate limit atteint, réessayez dans 1 minute' },
    { status: 429 }
  );
}
```

---

## 📊 DASHBOARD MODIFICATIONS

### Page `/customers`

**Modifications apportées** : Ajout de 2 cards prominentes en haut de page.

**Card 1 : Ajout Client Ultra-Rapide**
- Gradient : `from-orange-500 to-red-600`
- Icône : `Zap` (éclair)
- Titre : "Ajout Client Ultra-Rapide"
- Description : "Capturez un client en moins de 5 secondes avec juste son numéro"
- Bouton : "Ajouter un Client" (géant, h-14)
- Action : `router.push('/customers/quick')`

**Card 2 : QR Code Auto-Enregistrement**
- Gradient : `from-purple-500 to-indigo-600`
- Icône : `QrCode`
- Titre : "QR Code Auto-Enregistrement"
- Description : "Le client scanne et s'enregistre lui-même"
- Bouton : "Afficher le QR Code" (géant, h-14)
- Action : `router.push('/customers/qr-register')`

**Position** : Entre le header et la barre de recherche (lignes 195-229 du fichier).

**Code ajouté** :
```tsx
{/* Ajout Client ULTRA-Rapide */}
<div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 mb-4 text-white">
  <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
    <Zap className="w-6 h-6" />
    Ajout Client Ultra-Rapide
  </h2>
  <p className="text-sm opacity-90 mb-4">
    Capturez un client en moins de 5 secondes avec juste son numéro
  </p>
  <Button
    onClick={() => router.push('/customers/quick')}
    className="w-full bg-white text-red-600 hover:bg-red-50 h-14 text-lg font-bold rounded-xl shadow-lg"
  >
    <Phone className="w-6 h-6 mr-2" />
    Ajouter un Client
  </Button>
</div>

{/* QR Code Auto-Enregistrement */}
<div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-xl p-6 mb-4 text-white">
  <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
    <QrCode className="w-6 h-6" />
    QR Code Auto-Enregistrement
  </h2>
  <p className="text-sm opacity-90 mb-4">
    Le client scanne et s'enregistre lui-même
  </p>
  <Button
    onClick={() => router.push('/customers/qr-register')}
    className="w-full bg-white text-purple-600 hover:bg-purple-50 h-14 text-lg font-bold rounded-xl shadow-lg"
  >
    <QrCode className="w-6 h-6 mr-2" />
    Afficher le QR Code
  </Button>
</div>
```

**Imports ajoutés** :
```tsx
import { QrCode, Phone, Zap } from 'lucide-react';
```

---

## ✅ CHECKLIST DE DÉPLOIEMENT

### 1. Configuration WhatsApp

- [ ] Créer compte Meta Business
- [ ] Créer app WhatsApp Business
- [ ] Obtenir access token (long-lived)
- [ ] Enregistrer numéro de téléphone
- [ ] Vérifier le numéro
- [ ] Ajouter variables d'environnement dans `.env.local`
- [ ] Tester avec `whatsappService.sendTestMessage()`

### 2. Installation Dépendances

- [ ] Installer librairie QR Code :
  ```bash
  npm install qrcode.react
  npm install --save-dev @types/qrcode.react
  ```

- [ ] (Optionnel) Installer rate limiting :
  ```bash
  npm install @upstash/ratelimit @upstash/redis
  ```

### 3. Airtable

- [ ] Vérifier table `Customer` avec champs :
  - `Tags` (Multiple Select)
  - `ReferredBy` (Text)
  - `PreferredContactMethod` (Single Select)
  - `LastWhatsAppDate` (Date)
  - `Source` (Single Select avec option `quick_add`, `qr_self_registration`)

- [ ] Vérifier table `LoyaltyTransaction` pour bonus bienvenue

### 4. Tests

- [ ] Tester ajout client rapide :
  - Avec numéro seul
  - Avec nom
  - Avec WhatsApp activé
  - Avec WhatsApp désactivé
  - Avec bonus activé
  - Avec bonus désactivé

- [ ] Tester QR auto-enregistrement :
  - Génération QR Code
  - Scan QR Code
  - Formulaire client
  - Soumission avec téléphone seul
  - Soumission avec toutes infos
  - Gestion doublons

- [ ] Tester WhatsApp :
  - Configuration valide
  - Configuration invalide
  - Message de bienvenue
  - Message de test
  - Gestion erreurs API

### 5. Performance

- [ ] Vérifier temps de chargement pages :
  - `/customers/quick` : < 1s
  - `/customers/qr-register` : < 1s

- [ ] Vérifier temps création client :
  - Quick add : < 2s
  - QR register : < 2s

- [ ] Optimiser images si nécessaire
- [ ] Activer compression responses API

### 6. UX Mobile

- [ ] Tester sur vrai mobile (pas juste DevTools)
- [ ] Vérifier taille boutons (≥ 44px)
- [ ] Vérifier lisibilité textes
- [ ] Vérifier scroll (pas de zones bloquées)
- [ ] Vérifier keyboard sur inputs (type tel, email)

---

## 🎓 GUIDES D'UTILISATION

### Guide Commercial : Ajout Client Express

**Objectif** : Capturer un client en < 5 secondes

**Étapes** :
1. Ouvrir l'app sur `/customers`
2. Cliquer sur le bouton orange "Ajouter un Client"
3. Le numéro de téléphone est déjà sélectionné (auto-focus)
4. **Option A** : Taper directement le numéro (+225 01 23 45 67 89)
5. **Option B** : Cliquer sur l'opérateur (Orange, MTN, Moov) puis taper les 8 derniers chiffres
6. (Optionnel) Taper le nom du client
7. Vérifier que les 2 checkboxes sont cochées (WhatsApp + Bonus)
8. Cliquer sur le bouton géant violet "Enregistrer"
9. ✅ Client créé, message WhatsApp envoyé, 500 points ajoutés
10. Redirection automatique vers la fiche client

**Temps total** : 3-5 secondes

### Guide Commercial : QR Code

**Objectif** : Laisser le client s'enregistrer lui-même

**Étapes** :
1. Ouvrir l'app sur `/customers`
2. Cliquer sur le bouton violet "Afficher le QR Code"
3. Montrer l'écran au client
4. Client scanne le QR Code avec son téléphone (appareil photo ou WhatsApp)
5. Client remplit le formulaire :
   - Téléphone (obligatoire)
   - Nom, Email, Ville (optionnels)
   - Coche "Recevoir promotions WhatsApp" (recommandé)
6. Client clique "M'enregistrer"
7. ✅ Client enregistré, 500 points ajoutés, message WhatsApp envoyé
8. Client voit écran de confirmation

**Temps commercial** : 0 seconde (client se débrouille)

### Guide Admin : Envoyer une Promotion

**Objectif** : Envoyer une promo WhatsApp à un client ou segment

**Code** :
```typescript
import { whatsappService } from '@/lib/whatsapp/whatsapp-service';

// À un client spécifique
const customer = await customerService.getById('recXXX');
await whatsappService.sendPromotion(
  customer.Phone,
  customer.FullName,
  'OFFRE SPÉCIALE WEEK-END',
  'Profitez de -20% sur tous nos jus naturels ce week-end !',
  'dimanche 17/11',
  'https://example.com/promo.jpg'
);

// À un segment (tous les VIP)
const vipCustomers = await customerService.list(workspaceId, {
  status: 'vip'
});

for (const customer of vipCustomers) {
  await whatsappService.sendPromotion(
    customer.Phone,
    customer.FullName,
    'OFFRE EXCLUSIVE CLIENT VIP',
    'En tant que client VIP, profitez de -25% sur tout !',
    'dimanche 17/11'
  );

  // Pause 1 seconde entre chaque message (rate limiting)
  await new Promise(resolve => setTimeout(resolve, 1000));
}
```

---

## 🐛 DÉPANNAGE

### WhatsApp ne s'envoie pas

**Symptôme** : Client créé mais `whatsappSent: false`

**Vérifications** :
1. Variables d'environnement configurées ?
   ```bash
   echo $WHATSAPP_API_KEY
   echo $WHATSAPP_PHONE_NUMBER_ID
   ```

2. Service configuré ?
   ```typescript
   if (!whatsappService.isConfigured()) {
     console.error('WhatsApp API non configuré');
   }
   ```

3. Numéro valide ?
   - Doit être au format international (225XXXXXXXXXX)
   - Doit exister sur WhatsApp

4. Access token valide ?
   - Vérifier expiration dans Meta Developer Console
   - Régénérer si expiré (long-lived token recommandé)

5. Quota API atteint ?
   - Vérifier limites dans Meta Business Manager
   - Tier 1 = 1K messages/24h

**Debug** :
```typescript
const result = await whatsappService.sendTestMessage('+2250123456789');
console.log(result);
// Si erreur, result.error contient le détail
```

### QR Code ne se génère pas

**Symptôme** : Zone vide au lieu du QR Code

**Cause** : Librairie `qrcode.react` pas installée

**Solution** :
```bash
npm install qrcode.react
```

**Intégration** :
```tsx
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG
  value={generateQRCodeURL()}
  size={256}
  level="H"
  includeMargin={true}
/>
```

### Client en double

**Symptôme** : 409 Conflict lors de création

**Cause** : Numéro de téléphone déjà enregistré

**Comportement normal** :
- API retourne 409 avec `customerId` du client existant
- Front-end peut rediriger vers fiche client existante

**Fusion manuelle** (si vraiment nécessaire) :
```typescript
// À implémenter dans CustomerService
await customerService.merge(customerId1, customerId2);
```

### Formatage téléphone incorrect

**Symptôme** : Numéro non reconnu par WhatsApp

**Vérifications** :
- Nombre de chiffres : 10 (hors 225)
- Format envoyé à API : `2250123456789` (pas de + ni espaces)
- Fonction `formatPhoneNumber()` utilisée

**Test** :
```typescript
const cleaned = phone.replace(/\D/g, '');
console.log(cleaned); // Doit afficher 2250123456789
```

---

## 📈 MÉTRIQUES & ANALYTICS

### KPIs à Suivre

**Capture Client** :
- Nombre de clients ajoutés via Quick Add
- Nombre de clients ajoutés via QR Code
- Temps moyen de capture (cible < 5s pour Quick Add)
- Taux de conversion QR Code (scans → inscriptions)

**WhatsApp** :
- Messages envoyés / jour
- Taux de succès envoi
- Taux d'ouverture (si templates configurés)
- Taux de clics (si liens dans messages)

**Engagement** :
- % clients avec WhatsApp activé
- % clients utilisant points
- Fréquence de visite après inscription

### Tracking (À implémenter)

**Google Analytics Events** :
```typescript
// Ajout client rapide
gtag('event', 'customer_quick_add', {
  method: 'quick_add',
  time: performance.now() - startTime,
  whatsapp_sent: whatsappSent,
  bonus_added: bonusAdded
});

// QR Code scan
gtag('event', 'qr_code_scan', {
  stand_id: standId,
  agent_id: agentId
});

// WhatsApp envoyé
gtag('event', 'whatsapp_sent', {
  type: 'welcome',
  success: result.success
});
```

**Amplitude / Mixpanel** :
```typescript
amplitude.track('Customer Created', {
  source: 'quick_add',
  has_name: !!fullName,
  whatsapp_enabled: sendWelcomeWhatsApp,
  bonus_enabled: giveWelcomeBonus,
  time_to_create: performance.now() - startTime
});
```

---

## 🚀 ÉVOLUTIONS FUTURES

### Phase 2 : Templates WhatsApp

**Avantage** : Messages pré-approuvés par Meta pour marketing

**Setup** :
1. Créer templates dans Meta Business Manager
2. Soumettre pour approbation (24-48h)
3. Utiliser via `whatsappService.sendTemplate()`

**Exemples de templates** :
- `welcome_message` : Bienvenue + bonus
- `order_confirmation` : Confirmation commande
- `payment_reminder` : Relance paiement
- `promotion_vip` : Offre exclusive VIP

### Phase 3 : Chatbot WhatsApp

**Concept** : Répondre automatiquement aux messages entrants

**Fonctionnalités** :
- "Quel est mon solde de points ?" → Réponse auto
- "Quelles sont mes récompenses ?" → Liste récompenses
- "Je veux utiliser mes points" → Redirection vers app

**Tech** : Webhook WhatsApp Business API

### Phase 4 : Paiement par WhatsApp

**Concept** : Client paie via message WhatsApp

**Workflow** :
1. Commercial envoie demande de paiement
2. Client clique sur lien
3. Paiement Orange Money / MTN / Moov
4. Confirmation automatique
5. Facture envoyée par WhatsApp

**Intégration** : API paiement mobile (Cinetpay, Fedapay)

### Phase 5 : Carte de Fidélité Digitale

**Concept** : QR Code unique par client dans WhatsApp

**Workflow** :
1. Client s'inscrit
2. Reçoit QR Code personnel par WhatsApp
3. Présente QR Code en magasin
4. Scan = identification instantanée
5. Points ajoutés automatiquement

---

## 📞 SUPPORT

**Documentation** :
- Ce fichier : `MODULE_CLIENTS_WHATSAPP_QR.md`
- Documentation générale : `MODULE_CLIENTS_COMPLETE.md`

**Code Source** :
- WhatsApp Service : `lib/whatsapp/whatsapp-service.ts`
- Quick Add : `app/customers/quick/page.tsx`
- QR Register : `app/customers/qr-register/page.tsx`
- API Quick : `app/api/customers/quick/route.ts`
- API QR : `app/api/customers/qr-register/route.ts`
- API WhatsApp : `app/api/whatsapp/send-welcome/route.ts`

**Liens Utiles** :
- [Meta WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Meta Business Manager](https://business.facebook.com/)
- [qrcode.react npm](https://www.npmjs.com/package/qrcode.react)

---

**Version** : 1.0.0
**Date** : Novembre 2024
**Fonctionnalités** : Quick Add, QR Register, WhatsApp Integration
