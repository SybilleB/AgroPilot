import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Linking } from 'react-native';

export default function RechercheAides() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async() => {
        if (!query) return;
        setLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:8000/recherche-aides?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            setResults(data);
        } catch (error) {
            alert("Erreur de connexion au serveur Backend");
        } finally {
            setLoading(false);
        }
    };

    return ( <
        ScrollView style = { styles.container } >
        <
        Text style = { styles.title } > 🚜AgroPilot - Aides < /Text>

        <
        View style = { styles.searchBox } >
        <
        TextInput style = { styles.input }
        placeholder = "Ex: aides viticulture Charente..."
        value = { query }
        onChangeText = { setQuery }
        /> <
        TouchableOpacity style = { styles.button }
        onPress = { handleSearch }
        disabled = { loading } > {
            loading ? < ActivityIndicator color = "#fff" / > : < Text style = { styles.buttonText } > Chercher < /Text>} <
                /TouchableOpacity> <
                /View>

            {
                results && ( <
                    View style = { styles.resultCard } >
                    <
                    Text style = { styles.resultTitle } > Analyse pour: { results.query } < /Text> <
                    Text style = { styles.analysis } > { results.analyse_ia } < /Text>

                    <
                    Text style = { styles.sourceHeader } > 🔗Sources: < /Text> {
                        results.sources.map((url, index) => ( <
                            Text key = { index }
                            style = { styles.link }
                            onPress = {
                                () => Linking.openURL(url) } >
                            •Voir la source officielle { index + 1 } <
                            /Text>
                        ))
                    } <
                    /View>
                )
            } <
            /ScrollView>
        );
    }

    const styles = StyleSheet.create({
        container: { flex: 1, padding: 20, backgroundColor: '#fff', marginTop: 40 },
        title: { fontSize: 24, fontWeight: 'bold', color: '#2e7d32', marginBottom: 20, textAlign: 'center' },
        searchBox: { flexDirection: 'row', gap: 10, marginBottom: 30 },
        input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
        button: { backgroundColor: '#2e7d32', padding: 12, borderRadius: 8, justifyContent: 'center' },
        buttonText: { color: '#fff', fontWeight: 'bold' },
        resultCard: { backgroundColor: '#f0f4f0', padding: 15, borderRadius: 12 },
        resultTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
        analysis: { lineHeight: 22, color: '#333' },
        sourceHeader: { marginTop: 20, fontWeight: 'bold', fontSize: 16 },
        link: { color: '#1976d2', marginTop: 8, textDecorationLine: 'underline' }
    });