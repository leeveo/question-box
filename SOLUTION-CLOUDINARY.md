# Alternative: Conversion WebM → MP4 avec Cloudinary (GRATUIT et SIMPLE)

## ❌ Problème avec AWS Lambda
- Ton compte AWS n'a pas accès au Layer FFmpeg public
- Permissions Lambda insuffisantes pour déployer via CLI
- Déploiement manuel complexe

## ✅ Solution recommandée : Cloudinary

### Pourquoi Cloudinary ?
- ✅ **25 crédits/mois GRATUITS** (largement suffisant pour toi)
- ✅ **Conversion automatique WebM → MP4**
- ✅ **Pas de configuration AWS compliquée**
- ✅ **Fonctionne sur Vercel sans problème**
- ✅ **API ultra-simple** (3 lignes de code)
- ✅ **CDN inclus** (vidéos servies rapidement)

### Setup en 5 minutes

#### 1. Créer un compte Cloudinary
👉 https://cloudinary.com/users/register_free

#### 2. Récupérer tes credentials
- Dashboard → API Keys
- Copier : Cloud Name, API Key, API Secret

#### 3. Ajouter dans .env.local
```env
CLOUDINARY_CLOUD_NAME=ton-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

#### 4. Installer le SDK
```bash
npm install cloudinary
```

#### 5. Modifier l'upload (je peux le faire pour toi)

Au lieu d'uploader sur S3, on upload sur Cloudinary qui convertit automatiquement :

```javascript
// Upload WebM → Cloudinary convertit automatiquement en MP4
const result = await cloudinary.uploader.upload(videoBlob, {
  resource_type: 'video',
  format: 'mp4', // Conversion automatique !
  folder: 'questionbox',
});

// URL MP4 disponible immédiatement
const mp4Url = result.secure_url; 
```

### Comparaison

| Solution | Setup | Coût | Complexité | Temps |
|----------|-------|------|------------|-------|
| **AWS Lambda** | 30 min | Gratuit | ⭐⭐⭐⭐ | ~30s/vidéo |
| **Cloudinary** | 5 min | Gratuit | ⭐ | Instantané |

### Ce que je peux faire maintenant

**Option A : Implémenter Cloudinary** (recommandé)
- Je modifie `VideoRecorder.tsx` pour uploader sur Cloudinary
- Je modifie l'API pour utiliser les URLs Cloudinary
- Conversion automatique WebM → MP4
- **Temps : 10 minutes**

**Option B : CloudFormation avec FFmpeg inline**
- Je crée un template CloudFormation qui inclut FFmpeg dans le ZIP
- Tu le déploies en 1 clic depuis la console AWS
- Plus complexe mais reste sur AWS
- **Temps : 20 minutes**

**Quelle option tu préfères ?** 🤔

Je recommande **Option A (Cloudinary)** car c'est :
- ✅ Plus simple
- ✅ Plus rapide à mettre en place
- ✅ Plus fiable
- ✅ Moins de maintenance
- ✅ Gratuit aussi

Dis-moi ce que tu choisis ! 🚀
