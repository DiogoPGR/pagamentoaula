"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { QrCode, Copy, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface PixQRCodeProps {
  qrCode: string
  qrCodeBase64: string
  paymentId: string
  amount: number
  onPaymentComplete?: () => void
}

export function PixQRCode({ qrCode, qrCodeBase64, paymentId, amount, onPaymentComplete }: PixQRCodeProps) {
  const [copied, setCopied] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string>('pending')
  const [timeLeft, setTimeLeft] = useState(1800) // 30 minutos em segundos

  useEffect(() => {
    // Timer para expiração do PIX
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Verificar status do pagamento a cada 10 segundos
    const statusTimer = setInterval(async () => {
      try {
        const response = await fetch(`/api/payment-status?paymentId=${paymentId}`)
        const data = await response.json()
        
        if (data.status === 'approved') {
          setPaymentStatus('approved')
          onPaymentComplete?.()
          clearInterval(statusTimer)
        } else if (data.status === 'rejected') {
          setPaymentStatus('rejected')
          clearInterval(statusTimer)
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error)
      }
    }, 10000)

    return () => {
      clearInterval(timer)
      clearInterval(statusTimer)
    }
  }, [paymentId, onPaymentComplete])

  const copyPixCode = async () => {
    try {
      await navigator.clipboard.writeText(qrCode)
      setCopied(true)
      toast({
        title: "Código PIX copiado!",
        description: "Cole o código no seu app bancário para pagar.",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código PIX.",
        variant: "destructive",
      })
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'approved':
        return <CheckCircle className="h-6 w-6 text-green-500" />
      case 'rejected':
        return <AlertCircle className="h-6 w-6 text-red-500" />
      default:
        return <Clock className="h-6 w-6 text-yellow-500" />
    }
  }

  const getStatusText = () => {
    switch (paymentStatus) {
      case 'approved':
        return 'Pagamento Aprovado!'
      case 'rejected':
        return 'Pagamento Rejeitado'
      default:
        return 'Aguardando Pagamento'
    }
  }

  const getStatusDescription = () => {
    switch (paymentStatus) {
      case 'approved':
        return 'Seu pagamento foi confirmado. Você receberá o acesso ao produto em breve.'
      case 'rejected':
        return 'O pagamento não foi aprovado. Tente novamente ou entre em contato conosco.'
      default:
        return 'Escaneie o QR Code ou copie o código PIX para pagar.'
    }
  }

  if (paymentStatus === 'approved') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-green-600">{getStatusText()}</CardTitle>
          <CardDescription>{getStatusDescription()}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (paymentStatus === 'rejected') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-red-600">{getStatusText()}</CardTitle>
          <CardDescription>{getStatusDescription()}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
            variant="outline"
          >
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {getStatusIcon()}
        </div>
        <CardTitle>{getStatusText()}</CardTitle>
        <CardDescription>{getStatusDescription()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white p-4 rounded-lg">
            <img 
              src={`data:image/png;base64,${qrCodeBase64}`} 
              alt="QR Code PIX" 
              className="w-48 h-48"
            />
          </div>
        </div>

        {/* Código PIX */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Código PIX:</Label>
          <div className="flex items-center gap-2">
            <Input 
              value={qrCode} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button 
              onClick={copyPixCode} 
              size="sm" 
              variant="outline"
              className="shrink-0"
            >
              {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Timer de expiração */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Tempo restante para pagamento:</p>
          <div className="text-2xl font-mono font-bold text-primary">
            {formatTime(timeLeft)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Este PIX expira em 30 minutos
          </p>
        </div>

        {/* Instruções */}
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="font-semibold mb-2 text-sm">Como pagar:</h4>
          <ol className="text-sm text-muted-foreground space-y-1">
            <li>1. Abra o app do seu banco</li>
            <li>2. Escolha a opção PIX</li>
            <li>3. Escaneie o QR Code ou cole o código</li>
            <li>4. Confirme o pagamento</li>
          </ol>
        </div>

        {/* Status do pagamento */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium text-yellow-600">Aguardando</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            ID do pagamento: {paymentId}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
