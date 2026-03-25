// src/api.js

// Safely grab the URL from your .env file
export const API_URL = import.meta.env.VITE_API_URL;

export const auth = {
    token: localStorage.getItem('authToken') || null,
    user: JSON.parse(localStorage.getItem('authUser')) || null 
};

// Core fetch wrapper
export async function apiFetch(endpoint, options = {}, showLoading, hideLoading, handleLogout) {
    if (showLoading) showLoading();
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (auth.token) {
        headers['Authorization'] = `Bearer ${auth.token}`;
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
            body: options.body ? JSON.stringify(options.body) : null
        });
        
        if (hideLoading) hideLoading();

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = errorData.error || `Request failed with status ${response.status}`;
            
            if ((response.status === 401 || response.status === 403) && endpoint !== '/login') {
                errorMessage = "Your session has expired or is invalid. Please log in again.";
                if (handleLogout) handleLogout();
            }
            throw new Error(errorMessage);
        }
        
        if (response.status === 204) {
            return null;
        }
        
        return await response.json();

    } catch (err) {
        if (hideLoading) hideLoading();
        throw err;
    }
}