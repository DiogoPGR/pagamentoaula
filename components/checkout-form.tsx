"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CreditCard, QrCode } from "lucide-react"
import { PixQRCode } from "@/components/pix-qr-code"
import { toast } from "@/hooks/use-toast"

interface FormData {
  name: string
  email: string
  cpf: string
}

interface PixPayment {
  id: string
  status: string
  qr_code: string
  qr_code_base64: string
  external_reference: string
}

export function CheckoutForm() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    cpf: "",
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)
  const [showQRCode, setShowQRCode] = useState(false)

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      const response = await fetch('/api/pix-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: 2.00, // Valor fixo do produto
        }),
      })

      const data = await response.json()

      if (data.success) {
        setPixPayment(data.data)
        setShowQRCode(true)
        toast({
          title: "PIX gerado com sucesso!",
          description: "Escaneie o QR Code ou copie o código para pagar.",
        })
      } else {
        throw new Error(data.error || 'Erro ao gerar PIX')
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error)
      toast({
        title: "Erro ao gerar PIX",
        description: error instanceof Error ? error.message : "Tente novamente mais tarde.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePaymentComplete = () => {
    toast({
      title: "Pagamento confirmado!",
      description: "Você receberá o acesso ao produto em breve.",
    })
    // Aqui você pode redirecionar para uma página de sucesso ou fazer outras ações
  }

  const resetForm = () => {
    setShowQRCode(false)
    setPixPayment(null)
    setFormData({
      name: "",
      email: "",
      cpf: "",
    })
  }

    // Se o QR Code foi gerado, mostrar apenas ele
  if (showQRCode && pixPayment) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Pagamento PIX</h1>
          <p className="text-muted-foreground">Complete o pagamento para receber seu produto</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Resumo do Produto */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Resumo do Pedido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <img src="/digital-product.png" alt="Produto" className="w-12 h-12 object-cover rounded" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Produto Digital</h3>
                  <p className="text-sm text-muted-foreground">Acesso completo ao conteúdo</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>R$ 2,00</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de processamento:</span>
                  <span>R$ 0,00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">R$ 2,00</span>
                </div>
              </div>

              {/* Método de Pagamento */}
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Método de Pagamento</h4>
                <div className="border border-primary bg-primary/5 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium text-primary">PIX</p>
                      <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botão para voltar ao formulário */}
              <div className="mt-6">
                <Button 
                  onClick={resetForm} 
                  variant="outline" 
                  className="w-full"
                >
                  Voltar ao Formulário
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code PIX */}
          <div className="flex justify-center">
            <PixQRCode
              qrCode={pixPayment.qr_code}
              qrCodeBase64={pixPayment.qr_code_base64}
              paymentId={pixPayment.id}
              amount={2.00}
              onPaymentComplete={handlePaymentComplete}
            />
          </div>
        </div>
      </div>
    )
  }

  // Formulário normal
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Finalizar Compra</h1>
        <p className="text-muted-foreground">Complete seus dados para pagar via PIX</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Resumo do Produto */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Resumo do Pedido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                <img src="/digital-product.png" alt="Produto" className="w-12 h-12 object-cover rounded" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Produto Digital</h3>
                <p className="text-sm text-muted-foreground">Acesso completo ao conteúdo</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>R$ 2,00</span>
              </div>
              <div className="flex justify-between">
                <span>Taxa de processamento:</span>
                <span>R$ 0,00</span>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                                  <span className="text-primary">R$ 2,00</span>
              </div>
            </div>

            {/* Método de Pagamento */}
            <div className="mt-6">
              <h4 className="font-semibold mb-3">Método de Pagamento</h4>
              <div className="border border-primary bg-primary/5 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <QrCode className="h-6 w-6 text-primary" />
                  <div>
                    <p className="font-medium text-primary">PIX</p>
                    <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Formulário de Dados */}
        <Card>
          <CardHeader>
            <CardTitle>Dados do Comprador</CardTitle>
            <CardDescription>Preencha seus dados para gerar o código PIX</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="cpf">CPF *</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange("cpf", e.target.value)}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator className="my-6" />

              <Button type="submit" className="w-full h-12 text-lg font-semibold" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-5 w-5" />
                    Gerar PIX - R$ 2,00
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Ao finalizar a compra, você concorda com nossos{" "}
                <a href="#" className="text-primary hover:underline">
                  termos de uso
                </a>{" "}
                e{" "}
                <a href="#" className="text-primary hover:underline">
                  política de privacidade
                </a>
                .
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
