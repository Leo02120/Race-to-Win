// Configuration du client Supabase
const supabaseUrl = 'https://qjofwgrbuvpjqiargpil.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqb2Z3Z3JidXZwanFpYXJncGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0NjE0MTEsImV4cCI6MjA2NDAzNzQxMX0.tv1bMBSaF3jtLjlWxr_Wq8LeefgCfVtG8Dc9GOBDR58';

// Utiliser la librairie Supabase importée depuis le CDN
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

// Fonction pour insérer un nouvel utilisateur
async function insertUser(userData) {
  const { data, error } = await supabaseClient
    .from('users')
    .insert([
      {
        firstName: userData.firstName,
        email: userData.email,
        nickname: userData.nickname,
        password: userData.password,
        favoriteTeam: userData.favoriteTeam,
        isPremium: userData.isPremium
      }
    ]);
  if (error) {
    console.error('Error inserting user:', error);
  } else {
    console.log('User inserted successfully:', data);
  }
}

// Fonction pour récupérer un utilisateur par email
async function getUserByEmail(email) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', email);
  if (error) {
    console.error('Error retrieving user:', error);
  } else {
    console.log('User retrieved successfully:', data);
    return data;
  }
}

// Fonction pour mettre à jour un utilisateur
async function updateUser(userId, userData) {
  const { data, error } = await supabaseClient
    .from('users')
    .update({
      firstName: userData.firstName,
      email: userData.email,
      nickname: userData.nickname,
      password: userData.password,
      favoriteTeam: userData.favoriteTeam,
      isPremium: userData.isPremium
    })
    .eq('id', userId);
  if (error) {
    console.error('Error updating user:', error);
  } else {
    console.log('User updated successfully:', data);
  }
}

// Fonction pour supprimer un utilisateur
async function deleteUser(userId) {
  const { data, error } = await supabaseClient
    .from('users')
    .delete()
    .eq('id', userId);
  if (error) {
    console.error('Error deleting user:', error);
  } else {
    console.log('User deleted successfully:', data);
  }
}

// Fonction pour se connecter
async function login(email, password) {
  const { data, error } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password', password)
    .single();
  if (error) {
    console.error('Error logging in:', error);
    alert('Email ou mot de passe incorrect');
    return null;
  } else {
    return data;
  }
}

// Fonction pour s'inscrire
async function register(userData) {
  const { data: existingUser, error: existingUserError } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', userData.email)
    .single();
  if (existingUser) {
    alert('Cet email est déjà utilisé');
    return null;
  }
  if (!userData.favoriteTeam) {
    alert('Veuillez sélectionner votre équipe préférée');
    return null;
  }
  const { data, error } = await supabaseClient
    .from('users')
    .insert([userData]);
  if (error) {
    console.error('Error registering user:', error);
    alert('Erreur lors de l\'inscription');
    return null;
  } else {
    return userData;
  }
}

// Exporter les fonctions pour les utiliser dans d'autres fichiers
window.supabaseClient = supabaseClient;
window.insertUser = insertUser;
window.getUserByEmail = getUserByEmail;
window.updateUser = updateUser;
window.deleteUser = deleteUser;
window.login = login;
window.register = register;