"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/apiClient"


interface ContactMessage {
    id: number
    name: string
    email: string
    message: string
    status: "unread" | "read"
    created_at: string
}

export default function AdminContactMessagesPage() {
    const router = useRouter()
    const [messages, setMessages] = useState<ContactMessage[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"all" | "unread" | "read">("all")
    const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null)

    useEffect(() => {
        fetchMessages()
    }, [])

    const fetchMessages = async () => {
        try {
            const res = await apiClient.get('/admin/contact-messages/')

            if (res.status === 403 || res.status === 401) {
                alert('You do not have permission to access this page.')
                router.push('/dashboard')
                return
            }

            if (res.ok) {
                const data = await res.json()
                setMessages(data)
            }
        } catch (error) {
            console.error('Error fetching messages:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateMessageStatus = async (messageId: number, newStatus: "read" | "unread") => {
        try {
            const token = localStorage.getItem('token')
            const res = await apiClient.fetch(`/admin/contact-messages/${messageId}/status/`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            })

            if (res.ok) {
                fetchMessages()
                if (selectedMessage?.id === messageId) {
                    setSelectedMessage({ ...selectedMessage, status: newStatus })
                }
            }
        } catch (error) {
            console.error('Error updating message status:', error)
        }
    }

    const deleteMessage = async (messageId: number) => {
        if (!confirm('Are you sure you want to delete this message?')) return

        try {
            const token = localStorage.getItem('token')
            const res = await apiClient.delete(`/admin/contact-messages/${messageId}/`)

            if (res.ok || res.status === 204) {
                fetchMessages()
                setSelectedMessage(null)
            }
        } catch (error) {
            console.error('Error deleting message:', error)
        }
    }

    const filteredMessages = messages.filter(msg => {
        if (filter === "all") return true
        return msg.status === filter
    })

    const unreadCount = messages.filter(m => m.status === "unread").length

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="size-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 dark:text-slate-400">Loading messages...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 md:px-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                        Contact Messages
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400">
                        {unreadCount > 0 ? (
                            <span className="inline-flex items-center gap-2">
                                <span className="flex size-2 rounded-full bg-blue-600"></span>
                                {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                            </span>
                        ) : (
                            'No unread messages'
                        )}
                    </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {(['all', 'unread', 'read'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all ${filter === tab
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab !== 'all' && (
                                <span className="ml-2 text-sm opacity-75">
                                    ({messages.filter(m => m.status === tab).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Messages List */}
                {filteredMessages.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <span className="material-symbols-outlined text-slate-400 text-6xl mb-4">mail</span>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">No messages</h3>
                        <p className="text-slate-500">There are no {filter !== 'all' ? filter : ''} messages to display.</p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Email
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Message
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Date
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {filteredMessages.map(message => (
                                        <tr
                                            key={message.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                            onClick={() => setSelectedMessage(message)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {message.status === 'unread' && (
                                                        <span className="flex size-2 rounded-full bg-blue-600"></span>
                                                    )}
                                                    <span className="font-medium text-slate-900 dark:text-white">
                                                        {message.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                {message.email}
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate text-sm text-slate-600 dark:text-slate-400">
                                                {message.message}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${message.status === 'unread'
                                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    }`}>
                                                    {message.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                                                {new Date(message.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedMessage(message)
                                                    }}
                                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                                                >
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Message Detail Modal */}
            {selectedMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedMessage(null)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                                    Message from {selectedMessage.name}
                                </h2>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    {selectedMessage.email} • {new Date(selectedMessage.created_at).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedMessage(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${selectedMessage.status === 'unread'
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                    {selectedMessage.status}
                                </span>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
                                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                                    {selectedMessage.message}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                {selectedMessage.status === 'unread' ? (
                                    <button
                                        onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                                        className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Mark as Read
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => updateMessageStatus(selectedMessage.id, 'unread')}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                                    >
                                        Mark as Unread
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteMessage(selectedMessage.id)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
