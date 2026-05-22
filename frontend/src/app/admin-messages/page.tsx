"use client"
import { useNoIndex } from "@/hooks/useNoIndex"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiClient } from "@/lib/apiClient"
import { 
    Mail, 
    Calendar, 
    X, 
    CheckCircle2, 
    MailPlus, 
    Trash2,
    Search,
    Inbox
} from "lucide-react"


interface ContactMessage {
    id: number
    name: string
    email: string
    message: string
    status: "unread" | "read"
    created_at: string
}

export default function AdminContactMessagesPage() {
    useNoIndex()
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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground font-medium">Loading messages...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background py-8 px-4 md:px-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-10 animate-fade-in">
                    <h1 className="text-4xl font-extrabold text-primary mb-3 tracking-tight">
                        Contact Messages
                    </h1>
                    <div className="flex items-center gap-3">
                        {unreadCount > 0 ? (
                            <span className="inline-flex items-center gap-2 bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                                <span className="flex size-2 rounded-full bg-primary animate-pulse"></span>
                                <span className="text-sm font-bold text-primary">{unreadCount} unread message{unreadCount !== 1 ? 's' : ''}</span>
                            </span>
                        ) : (
                            <span className="text-muted-foreground text-sm font-medium">All caught up! No unread messages.</span>
                        )}
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex gap-2 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    {(['all', 'unread', 'read'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setFilter(tab)}
                            className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${filter === tab
                                ? 'bg-primary text-primary-foreground shadow-premium'
                                : 'bg-card text-muted-foreground hover:bg-secondary border border-border'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {tab !== 'all' && (
                                <span className="ml-2 opacity-60">
                                    {messages.filter(m => m.status === tab).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Messages List */}
                {filteredMessages.length === 0 ? (
                    <div className="bg-card rounded-2xl border border-border p-20 text-center animate-fade-in shadow-sm" style={{ animationDelay: '0.2s' }}>
                        <div className="size-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                            <Inbox className="size-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-2xl font-bold text-primary mb-2">No messages found</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto">There are no {filter !== 'all' ? filter : ''} messages in your inbox right now.</p>
                    </div>
                ) : (
                    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-premium animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-secondary/50 border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Sender</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Message</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {filteredMessages.map(message => (
                                        <tr
                                            key={message.id}
                                            className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                                            onClick={() => setSelectedMessage(message)}
                                        >
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        {message.status === 'unread' && (
                                                            <span className="size-2 rounded-full bg-primary shadow-[0_0_8px_rgba(0,0,0,0.2)]"></span>
                                                        )}
                                                        <span className={`font-bold text-primary ${message.status === 'unread' ? 'text-lg' : 'text-base'}`}>
                                                            {message.name}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground font-medium">{message.email}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 max-w-xs md:max-w-md">
                                                <p className="text-sm text-primary truncate leading-relaxed">
                                                    {message.message}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${message.status === 'unread'
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-secondary text-muted-foreground border-border'
                                                    }`}>
                                                    {message.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap text-sm text-muted-foreground font-medium">
                                                {new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-5 whitespace-nowrap text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setSelectedMessage(message)
                                                    }}
                                                    className="px-4 py-2 bg-secondary text-primary hover:bg-primary hover:text-primary-foreground rounded-lg text-xs font-bold transition-all shadow-sm"
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
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" onClick={() => setSelectedMessage(null)}>
                    <div className="bg-card rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border animate-in slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
                        <div className="p-8 border-b border-border flex justify-between items-start sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                            <div>
                                <h2 className="text-3xl font-extrabold text-primary mb-1 tracking-tight">
                                    Message from {selectedMessage.name}
                                </h2>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-medium">
                                    <span className="flex items-center gap-1.5"><Mail className="size-4" /> {selectedMessage.email}</span>
                                    <span className="text-border">•</span>
                                    <span className="flex items-center gap-1.5"><Calendar className="size-4" /> {new Date(selectedMessage.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedMessage(null)}
                                className="size-10 bg-secondary rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="mb-6">
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${selectedMessage.status === 'unread'
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-secondary text-muted-foreground border-border'
                                    }`}>
                                    {selectedMessage.status}
                                </span>
                            </div>

                            <div className="bg-secondary/40 rounded-2xl p-6 mb-8 border border-border/50">
                                <p className="text-lg text-primary whitespace-pre-wrap leading-relaxed">
                                    {selectedMessage.message}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                {selectedMessage.status === 'unread' ? (
                                    <button
                                        onClick={() => updateMessageStatus(selectedMessage.id, 'read')}
                                        className="flex-1 px-6 py-3 bg-success text-success-foreground hover:opacity-90 font-bold rounded-xl transition-all shadow-premium flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle2 className="size-5" />
                                        Mark as Read
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => updateMessageStatus(selectedMessage.id, 'unread')}
                                        className="flex-1 px-6 py-3 bg-secondary text-primary border border-border hover:bg-background font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        <MailPlus className="size-5" />
                                        Mark as Unread
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteMessage(selectedMessage.id)}
                                    className="px-6 py-3 bg-destructive text-destructive-foreground hover:opacity-90 font-bold rounded-xl transition-all shadow-premium flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="size-5" />
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
